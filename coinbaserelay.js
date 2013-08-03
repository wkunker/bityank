var express = require('express');
var app = express(express.logger());
var request = require('request');
var mongoose = require('mongoose');
var config = require('./config.js');

var port = process.env.PORT || 8888;
var Stats30s;
var Stats1hr;
var statsSinceLastHrAvg = 0;

// Time between market checks in ms.
var intervalTime = 30000;

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
  // Coinbase price check URL
  request('https://coinbase.com/api/v1/prices/' + action, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      callback(JSON.parse(response.body).total.amount);
    } else {
      if(error) {
        callback(response.statusCode, error);
      } else {
        callback(null, response.statusCode);
      }
    }
  });
}
  
var loadMarketPrice = function() {
  var buytotal;
  var selltotal;
  
  // Updates mongo with the hourly average - accepts an array of all 30s stats for the hour (120 in total)
  var updateStats1hr = function(arrStats30s) {
    if(arrStats30s.length != 120) {
      console.log("Error occured while calling updateStats1hr: 30s stats array wasn't 120 elements in length.");
      throw "30s stats array wasn't 120 elements in length.";
    }
    
    
    
    var buysum = 0;
    var sellsum = 0;
    var arrLen = arrStats30s.length;
    
    for(var i = 0; i < arrLen; i++) {
      buysum += arrStats30s[i].buytotal;
      sellsum += arrStats30s[i].selltotal;
    }
    
    var rslt = {"timestart": Number(arrStats30s[0].time), "timeend": Number(arrStats30s[arrLen-1].time),
                buytotal: buysum / arrLen, selltotal: sellsum / arrLen};
    
    var statModel = new Stats1hr(rslt);
    statModel.save(function(err, product) {
      if(err) {
        console.log('Problem uploading stat to mongo (\'' +
                    err.toString() + '\')');
      } else {
        console.log('Successfully uploaded hourly average (time: ' + Date.now() + ')');
      }
    });
  }
  
  var updateStatistics = function(buyval, sellval) {
    var timeout;
    
    if(isNaN(buyval) || isNaN(sellval) ||
        buyval === undefined || sellval === undefined ||
        buyval === null || sellval === null) {
      var msg = 'updateStatistics: buyval or sellval failed to update. Trying again...';
      process.stderr.write(msg);
      console.log(msg);
      clearTimeout(timeout);
      loadMarketPrice();
      throw msg;
    }
    
    var stat = {"time": Date.now(), "buytotal": Number(buyval), "selltotal": Number(sellval)};
    var statModel = new Stats30s(stat);
      
    // Product is what was added to the db.
    var behavior = function(err, product) {
      if(err) {
        console.log('Problem uploading stat to mongo (\'' +
                    err.toString() + '\')');
      } else {
        statistics.push(stat);
        //console.log('[' + Date.now() + '] Pushing statistic... ');
        
        if(statsSinceLastHrAvg >= 120) {
          // Average the hour and add it to mongo.
          // Pass last 120 30s stats to updateStats1hr
          updateStats1hr(statistics.slice(statistics.length - 121, statistics.length - 1));
          
          statsSinceLastHrAvg = 0;
        } else {
          statsSinceLastHrAvg++;
        }
      }
    }
      
    statModel.save(behavior);
  }
  
  var checkBuyTradePriceOnComplete = function(result, err) {
    if(err) {
      var buyErrMsg = 'ERROR: failed to check buy exchange price';
      console.log(buyErrMsg);
      throw buyErrMsg;
    }
    
    buytotal = result;
    checkTradePrice('sell', checkSellTradePriceOnComplete);
  }
  
  var checkSellTradePriceOnComplete = function(result, err) {
    if(err) {
      var sellErrMsg = 'ERROR: failed to check sell exchange price';
      console.log(sellErrMsg);
      throw sellErrMsg;
    }
    
    selltotal = result;
    updateStatistics(buytotal, selltotal);
  }
  
  checkTradePrice('buy', checkBuyTradePriceOnComplete);
  timeout = setTimeout(loadMarketPrice, intervalTime);
}

app.listen(port, function() {
  console.log("Listening on " + port);
  
  mongoose.connect(config.dburl);
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback () {
    var statsSchema30s = mongoose.Schema({"time":Number, buytotal: Number, selltotal: Number});
    var statsSchema1hr = mongoose.Schema({"timestart":Number, "timeend":Number, buytotal: Number, selltotal: Number});
    Stats30s = mongoose.model('stats30s', statsSchema30s);
    Stats1hr = mongoose.model('stats1hr', statsSchema1hr);
    
    loadMarketPrice();
  });
});
