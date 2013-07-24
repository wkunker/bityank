var express = require('express');
var app = express(express.logger());
var request = require('request');

var port = process.env.PORT || 8888;

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
  setTimeout(loadMarketPrice, intervalTime);
}

app.get('/stats', function(request, response) {
  // Display the last N statistics as JSON.
  var output = getLastNElements(statistics, numElements);
  
  response.send(output);
});

app.listen(port, function() {
  console.log("Listening on " + port);
  
  loadMarketPrice();
});
