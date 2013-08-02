var express = require('express');
var fs = require('fs');
var app = express(express.logger());
var indexPage;
var libRequest = require('request');
var mongoose = require('mongoose');
var config = require('./config.js');

var Stats30s;

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
  Stats30s.find({}, {_id:0, __v:0}, function (err, stats) {
    if (!err) {
      response.send(stats);
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
    Stats30s = mongoose.model('stats30s', statsSchema30s);
  });
});
