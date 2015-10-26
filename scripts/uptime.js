'use strict';

var co = require('co');
var BPromise = require('bluebird');
var redisClient = BPromise.promisifyAll(require('redis').createClient());

co(function* () {
  var date = new Date();
  yield redisClient.setAsync('uptime', date.getTime());
  console.log('Setted time to ' + date.getTime() + ' (' + date.toString() + ')');
  process.exit();
});
