var express = require('express');
var fs = require('fs');
var app = express(express.logger());
var indexPage;
var libRequest = require('request');
var mongoose = require('mongoose');
var config = require('./config.js');

var Stats30s_6h;
var Stats1hr_24h;

// Max number of statistic elements that can be sent through /stats/*
var num30s6hElements = 360; // 6hr period
var num1hr24hElements = 24; // 24hr period

var getLastNElements = function(arr, n) {
  return arr.slice(Math.max(arr.length - n, 0));
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

app.get('/stats/30s/6h', function(request, response) {
  Stats30s_6h.find({}, {_id:0, __v:0}, function (err, stats) {
    if (!err) {
      response.send(getLastNElements(stats, num30s6hElements));
    } else {
      response.send("Error: Bityank Coinbase relay down. Please try again shortly.");
    }
  });
});

app.get('/stats/1hr/24h', function(request, response) {
  Stats1hr_24h.find({}, {_id:0, __v:0}, function (err, stats) {
    if (!err) {
      response.send(getLastNElements(stats, num1hr24hElements));
    } else {
      response.send("Error: Bityank Coinbase relay down. Please try again shortly.");
    }
  });
});

var port = process.env.PORT || 8080;

app.listen(port, function() {
  loadIndex();
  console.log("Listening on " + port);
  
  mongoose.connect(config.dburl);
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback () {
    var statsSchema30s = mongoose.Schema({"time":Number, buytotal: Number, selltotal: Number});
    var statsSchema1hr = mongoose.Schema({"timestart":Number, "timeend":Number, buytotal: Number, selltotal: Number});
    Stats30s_6h = mongoose.model('stats30s', statsSchema30s);
    Stats1hr_24h = mongoose.model('stats1hr', statsSchema1hr);
  });
});
