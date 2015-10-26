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

var co = require('co');
var express = require('express');
var router = express.Router();
var validator = require('validator');
var BPromise = require('bluebird');
var redisClient = BPromise.promisifyAll(require('redis').createClient());


var github = require('../services/github');
var users = require('../services/users');

router.use(require('./authentication'));
router.use(require('./comment'));
router.use(require('./settings'));

router.get('/', co.wrap(function* (req, res) {
  var commentCount = yield redisClient.getAsync('commentCount');
  var timeStamp = yield redisClient.getAsync('uptime');
  var uptime = new Date((new Date()).getTime() - timeStamp);
  var userCount = yield users.countUsers();

  return res.render('index', {
    commentCount: commentCount,
    userCount: userCount,
    uptime: uptime
  });
}));

router.get('/getting-started', function(req, res) {
  if (!req.isAuthenticated() || 'full' !== req.user.type) {
    return res.redirect('/');
  }

  return res.render('getting_started');
});

router.get('/faq', function(req, res) {
  return res.render('faq');
});

router.get('/tos', function(req, res) {
  return res.render('tos');
});

/**
 * Send me an invitation
 */
router.get('/invitation', function(req, res, next) {
  if (req.isAuthenticated() && 'full' === req.user.type) {
    return res.redirect('/');
  }

  var invalidInvitation;
  if (req.session.invalidInvitation) {
    invalidInvitation = true;
    delete req.session.invalidInvitation;
  }

  return res.render('invitation', {invalidInvitation: invalidInvitation});
});

router.post('/invitation', function(req, res, next) {
  if (req.isAuthenticated() && 'full' === req.user.type) {
    return res.redirect('/');
  }

  if (!validator.isEmail(req.body.email)) {
    return res.sendStatus(400);
  }

  co(function* () {
    try {
      yield users.addInvitation(req.body.email);
    } catch (err) {
      if ('InvitationAskedError' === err.name) {
        return res.render('invitation', {error : err.message});
      }

      throw err;
    }

    return res.render('invitation_thanks');
  }).catch(next);
});

/**
 * Consume invitation
 */
router.get('/invitation/:code', function(req, res, next) {
  req.session.invitation = req.params.code;

  res.redirect('/login');
});

/*
 * Administration route
 */
router.get('/admin', function(req, res, next) {
  if (!req.isAuthenticated() || 'guilro' !== req.user.username) {
    return res.sendStatus(404);
  }

  co(function* () {
    var results = yield {
      rateLimit: github.rateLimit(),
      userList: users.list()
    };

    return res.render('admin', results);
  }).catch(function(err) {
    return next(err);
  });

  return;
});

module.exports = router;
