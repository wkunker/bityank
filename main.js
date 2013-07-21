var express = require('express');
var fs = require('fs');
var app = express(express.logger());
var indexPage;
var request = require('request');

// General statistics for giving the user an idea of the current Coinbase market value.
// "time", "buytotal", "selltotal"
var statistics = [];

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
    statistics.push({"time": Date.now(), "buytotal": buyval, "selltotal": sellval});
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
  setTimeout(loadMarketPrice, 30000);
}

var indexLoadFail = function(e) {
  console.log('Problem loading index.html -- "' + e + '"');
  process.exit(1);
};

var loadIndex = function() {
  try {
    indexPage = fs.readFileSync('index.html').toString();
  } catch(e) {
    indexLoadFail(e);
  }
};

app.get('/', function(request, response) {
  if(indexPage === undefined) {
    indexLoadFail('EXCEPTION NOT CAUGHT');
  }
  
  response.send(indexPage);
});

app.get('/stats', function(request, response) {
  var numElements = 500;
  
  var getLastNElements = function(arr, n) {
    return arr.slice(Math.max(arr.length - n, 0))
  };
  
  // Display the last N statistics as JSON.
  var output = getLastNElements(statistics, numElements);
  
  response.send(output);
});

var port = process.env.PORT || 8080;

app.listen(port, function() {
  loadIndex();
  console.log("Listening on " + port);
  
  loadMarketPrice();
});
