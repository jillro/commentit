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
var uuid = require('node-uuid');
var github = require('../github');
var log = require('../log');
var Commenter = require('../users').Commenter;
var he = require('he');

router.post('/comment/csrf', function(req, res, next) {
  var token = uuid.v4();
  var timeout = new Date(new Date().getTime() + 30000);
  req.session.csrf = { code: token, timeout: timeout };

  res.send(token);
});

/*
 * Post comments by POSTing JSON with
 * data.username The github account linked to a comm(ent|it) account
 * data.content  The comment content
 * (
 * data.path     The path to the file in the repo
 * OR
 * data.id       The page id in the database.
 * data.file     The database file (optional)
 * )
 * From here repo is separated into left part (owner) and right part
 */
router.post('/comment/:owner/:repoName', co.wrap(function* (req, res, next) {
  if (!req.user) {
    return res.status(401).send('Not authenticated.');
  }

  if (!req.session.csrf || req.session.csrf.timeout > new Date()) {
    res.status(401).send('CSRF token expired');
  }

  if (req.session.csrf.code !== req.body.csrf) {
    res.status(401).send('invalid CSRF token');
  }

  if(!req.body || !(req.body.path || req.body.id) || !req.body.content) {
    return res.status(400).send('bad configuration. Check <a href="https://commentit.io/settings">settings documentation</a>');
  }

  if (req.body.content.length > 10000) {
    return res.status(400).send('this comment is way too long !');
  }

  var username = req.body.username;
  var project = (req.params.owner + '.github.io' !== req.params.repoName);
  var branch = project ? 'gh-pages': 'master';

  // Information on the page to comment.
  var page = {
    owner: req.params.owner,
    repo: req.params.repoName,
    branch: branch,
    path: null,
    id: null,
    file: null
  };

  if (req.body.path) {
    page.path = req.body.path;
  } else {
    page.id = req.body.id;
    page.file = req.body.file || 'comments'; // this is redondent, the front end already fills this default value
  }

  var comment = {
    author: new Commenter(req.user),
    content: he.encode(req.body.content, { 'useNamedReferences': true })
  };

  var state;
  try {
    state = yield github.comment(username, page, comment);
  } catch (err) {
    if ('CommentError' == err.name) {
      return res.status(500).send(err.message);
    }

    log.error({stack: err.stack}, err.message);

    return res.status(500).send('please try again later');
  }

  return res.status(200).send(state);

}));

module.exports = router;
