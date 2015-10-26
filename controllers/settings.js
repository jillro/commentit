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

var debug = require('debug')('commentit:controller:settings');
var express = require('express');
var router = express.Router();
var validator = require('validator');

var users = require('../users');

/*
 * Settings
 */
router.get('/settings', function(req, res, next) {
  if (!req.isAuthenticated() || 'full' !== req.user.type) {
    return res.redirect('/');
  }

  return res.render('settings');
});

/*
 * Ajax set an option
 */
router.post('/settings/:option/:value', function(req, res, next) {
  if (!req.isAuthenticated() || 'full' !== req.user.type) {
    return res.redirect('/login');
  }

  if (!validator.isIn(req.params.option, ['master', 'group'])) {
    debug(req.user.username + ' tried to set unkown option.');

    return res.status(404).send('This option does not exists.');
  }

  var value = 'true' ===req.params.value ? true : false ;

  users.setOption(req.user.id, req.params.option, value).then(function() {
    return res.json({ option: req.params.option, value: value });
  }).catch(next);
});

router.get('/test', function(req, res) {
  if (!req.isAuthenticated() || 'full' !== req.user.type) {
    return res.redirect('/login');
  }

  return res.render('test.jade');
});

module.exports = router;
