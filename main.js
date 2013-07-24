var express = require('express');
var fs = require('fs');
var app = express(express.logger());
var indexPage;
var libRequest = require('request');

// General statistics for giving the user an idea of the current Coinbase market value.
// "time", "buytotal", "selltotal"
var statistics = [];

/*
 * Makes a GET request to Coinbase.
 * On success, callback is called with the price as the only parameter.
 * On failure, callback is called with the status code and error result as two total parameters.
 * Valid actions are 'buy' and 'sell'
 */
var checkTradePrice = function(callback) {
  libRequest('http://bitcrank-17627.use1.actionbox.io:8888/stats/30s', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      callback(JSON.parse(response.body));
    } else {
      callback(response.statusCode, error);
    }
  });
};

var loadMarketPrice = function() {  
  var updateStatistics = function(buytotal, selltotal, time) {
    statistics.push({"time": time, "buytotal": buytotal, "selltotal": selltotal});
    console.log('[' + Date.now() + '] Pushing statistic... ');
  }
  
  checkTradePrice(function(body, err) {
    if(err) {
      console.log('Error while checking trade price: ' + err);
      throw new Exception('Error while checking trade price: ' + err);
    }
    
    var last = body[body.length - 1];
    var buytotal = last.buytotal;
    var selltotal = last.selltotal;
    var time = last.time;
    updateStatistics(buytotal, selltotal, time);
  });
  
  setTimeout(loadMarketPrice, 30000);
};

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
  libRequest('http://bitcrank-17627.use1.actionbox.io:8888/stats/30s', function (err, res, bod) {
    if (!err && res.statusCode == 200) {
      response.send(res.body);
    } else {
      response.send("Error: Bityank Coinbase relay down. Please try again shortly.");
    }
  });  
});

var port = process.env.PORT || 8080;

app.listen(port, function() {
  loadIndex();
  console.log("Listening on " + port);
  
  //loadMarketPrice();
});
