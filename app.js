/**
 * Copyright 2015 Guillaume Royer
 *
 * This file is part of Comm(ent|it).
 *
 * Comm(ent|it) is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Comm(ent|it) is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Comm(ent|it).  If not, see <http://www.gnu.org/licenses/>. 1
 */

'use strict';

/**
 * Ce fichier configure l'application express, importe les objets router depuis
 * ./controllers, et fait écouter le serveur.
 */

/**
 * Import modules
 */
var bodyParser = require('body-parser');
var co = require('co');
var debug= require('debug')('commentit:server');
var express = require('express');
var MongoStore = require('connect-mongo')(require('express-session'));
var morgan = require('morgan');
var passport = require('passport');
var session = require('express-session');

/**
 * Import modules internes.
 */
var controllersLoader = require('./controllers');
var github = require('./services/github');
var users = require('./services/users');
var log = require('./services/log');
var config = require('./config');

log.info('new server process');

/**
 * Middlewares
 */
var app = express();

app.set('views', './views');
app.set('view engine', 'jade');

app.use('/static/', express.static(__dirname + '/static/', {maxAge: '365d'})); // static files
if ('production' !== process.env.NODE_ENV) {
  app.use(morgan('dev')); // log
}
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(session({
  secret: config.secret,
  store: new MongoStore({ db: 'commentit' }),
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(function setUserInLocals(req, res, next){ // we want the passport user object to be available in templates
  res.locals.url = req.originalUrl;
  res.locals.user = req.user;
  res.locals.fullyAuthenticated = req.isAuthenticated() && 'full' === req.user.type;

  return next();
});

/**
 * Mounting controllers Router object.
 */
app.use(require('./controllers'));

/**
 * Error handling middleware
 */
app.use(function(err, req, res, next) {
  log.error({stack: err.stack}, err.message);

  return res.status(500).render('error');
});

/**
 * Starting script
 */
co(function* () {
  yield users.connected; // wait for user repository to be connected

  setInterval(function() {
    log.info('try to send next invitation');
    users.sendNextInvitation();

    return;
  }, 1000 * (3600/ config.invitationsHour));

  var server = app.listen(process.env.PORT || 3000, '127.0.0.1', function () {

    var host = server.address().address;
    var port = server.address().port;

    log.info('server listening at http://%s:%s', host, port);

  });
}).catch(function(err) {
  log.fatal(err.message);
  process.exit(1);
});
