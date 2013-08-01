var express = require('express');
var app = express(express.logger());
var request = require('request');
var mongoose = require('mongoose');

var port = process.env.PORT || 8888;
var Stats30s;

// Max number of statistic elements that can be sent through /stats/*
var numElements = 500;

// Time between market checks in ms.
var intervalTime = 30000;

// General statistics for giving the user an idea of the current Coinbase market value.
// "time", "buytotal", "selltotal"
var statistics = [];

var getLastNElements = function(arr, n) {
  return arr.slice(Math.max(arr.length - n, 0));
};
/*
 * Makes a GET request to Coinbase.
 * On success, callback is called with the price as the only parameter.
 * On failure, callback is called with the status code and error result as two total parameters.
 * Valid actions are 'buy' and 'sell'
 */
var checkTradePrice = function(action, callback) {
  request('https://coinbase.com/api/v1/prices/' + action, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      callback(JSON.parse(response.body).total.amount);
    } else {
      callback(response.statusCode, error);
    }
  });
}
  
var loadMarketPrice = function() {
  var buytotal;
  var selltotal;
  
  
  
  var updateStatistics = function(buyval, sellval) {
    var stat = {"time": Date.now(), "buytotal": Number(buyval), "selltotal": Number(sellval)};
    var statModel = new Stats30s(stat);
    // Product is what was added to the db.
    statModel.save(function(err, product) {
      if(err) {
        console.log('Problem uploading stat to mongo (\'' +
                    stat.toString() + '\')');
      }
    });
    statistics.push(stat);
    console.log('[' + Date.now() + '] Pushing statistic... ');
  }
  
  var checkBuyTradePriceOnComplete = function(result, err) {
    if(err) {
      var buyErrMsg = 'ERROR: failed to check buy exchange price';
      console.log(buyErrMsg);
      throw new Exception(buyErrMsg);
    }
    
    buytotal = result;
    checkTradePrice('sell', checkSellTradePriceOnComplete);
  }
  
  var checkSellTradePriceOnComplete = function(result, err) {
    if(err) {
      var sellErrMsg = 'ERROR: failed to check sell exchange price';
      console.log(sellErrMsg);
      throw new Exception(sellErrMsg);
    }
    
    selltotal = result;
    updateStatistics(buytotal, selltotal);
  }
  
  checkTradePrice('buy', checkBuyTradePriceOnComplete);
  setTimeout(loadMarketPrice, intervalTime);
}

app.get('/stats', function(request, response) {
  // Display the last N statistics as JSON.
  var output = getLastNElements(statistics, numElements);
  
  response.send(output);
});

app.listen(port, function() {
  console.log("Listening on " + port);
  
  mongoose.connect("mongodb://user:password@ds037698.mongolab.com:37698/bityank");
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback () {
    var statsSchema30s = mongoose.Schema({"time":Number, buytotal: Number, selltotal: Number});
    Stats30s = mongoose.model('stats30s', statsSchema30s);
    
    loadMarketPrice();
  });
});
