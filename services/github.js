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

var atob = require('atob');
var BPromise = require('bluebird');
var btoa = require('btoa');
var co = require('co');
var crypto = require('crypto');
var debug = require('debug')('commentit:git');
var GithubApi = BPromise.promisifyAll(require('github'));
var jsYaml = require('js-yaml');
var YAML = require('yamljs');
var utf8 = require('utf8');
var validator = require('validator');
var redisClient = require('redis').createClient();
var lock = require('redis-lock')(redisClient);

var config = require('../config');
var users = require('./users');
var log = require('./log');
var fileEditor = require('./file-editor');

/**
 * Error class for bad comment request.
 * @class
 */
function CommentError(message) {
    this.name = 'CommentError';
    this.message = 'could not commit the comment to github (' + message + ')';
}
CommentError.prototype = new Error();
CommentError.prototype.constructor = CommentError;
module.exports.CommentError = CommentError;

module.exports.getEmail = co.wrap(function* (token) {
  var github = new GithubApi({
    // required
    version: '3.0.0',
    protocol: 'https',
    timeout: 10000,
    headers: {
      'User-Agent': config.appName, // GitHub is happy with a unique user agent
    },
    debug: config.debug
  });

  github.authenticate({
    type: 'oauth',
    token: token
  });

  BPromise.promisifyAll(github.user);

  var res = yield github.user.getEmailsAsync({});

  return res[0].email;
});

/**
 * @typedef rateLimitResult
 * @property {integer}  limit
 * @property {integer}  remaining
 * @property {Date}     reset
 */

/**
 * Get global app rate limits.
 * @return  Promise<rateLimitResult>
 */
module.exports.rateLimit = co.wrap(function*() {
  var githubOptions = {
    // required
    version: '3.0.0',
    protocol: 'https',
    timeout: 10000,
    headers: {
      'User-Agent': config.appName, // GitHub is happy with a unique user agent
    },
    debug: config.debug
  };
  var githubPosting = new GithubApi(githubOptions);
  var githubLogin = new GithubApi(githubOptions);

  githubPosting.authenticate({
    type: 'oauth',
    key: config.githubId,
    secret: config.githubSecret
  });

  githubLogin.authenticate({
    type: 'oauth',
    key: config.githubCommenterId,
    secret: config.githubCommenterSecret
  });

  BPromise.promisifyAll(githubPosting.misc);
  BPromise.promisifyAll(githubLogin.misc);

  var results = yield {
    posting: githubPosting.misc.rateLimitAsync({}),
    login: githubLogin.misc.rateLimitAsync({})
  };

  debug('Got rate limits : ' + JSON.stringify(results));

  return {
    posting: results.posting.rate,
    login: results.login.rate
  };
});

/**
 * Send a comment to a page.
 * @param {string}          username              The user who gave comm(ent|it) write access to the repo.
 * @param {object}          page                  Page object
 * @param {string}          page.owner            Owner if different from user (i.e. if orga)
 * @param {string}          page.repo
 * @param {string}          page.branch
 * (
 * @param {string}          page.path             The path of the post file.
 * OR
 * @param {string}          page.id               The page id in the database file.
 * @param {string}          page.file             The file where the comment should be stored (without .yml)
 * )
 * @param {object}          comment               The comment
 * @param {string}          comment.content       Text !
 * @param {Commenter}       comment.author        Typedef is in users.js
 * @return Promise          Resolve the promise to true when posted
 */
module.exports.comment = function (username, page, comment) {
  var debug = require('debug')(
    'commentit:git:' +
    username +
    ':' + page.repo +
    ':' + page.branch +
    ':' + page.path
  );

  debug('operation pending');
  return new Promise(function (resolve, reject) {
    return lock(page.owner + '/' + page.repo, co.wrap(function* (done) {
      try {
        debug('operation starting');
        var operation = yield realComment(username, page, comment, debug);
        resolve(operation);
      } catch (err) {
        reject(err);
      } finally {
        done();
      }
    }));
  });
};

var realComment = co.wrap(function* (username, page, comment, debug) {
  var repo = page.repo;
  var owner = page.owner;
  var origBranchName = page.branch;
  var path = page.path || '_data/' + page.file + '.yml'; // path is here the post or the database
  comment.date = new Date();

  // New GithubApi instance for each new user.
  var github = new GithubApi({
    version: '3.0.0',
    protocol: 'https',
    timeout: 10000,
    headers: {
      'User-Agent': config.appName, // GitHub is happy with a unique user agent
    },
    debug: config.debug
  });

  debug('Start promisifying github client.');
  BPromise.promisifyAll(github.repos);
  BPromise.promisifyAll(github.user);
  BPromise.promisifyAll(github.pullRequests);
  debug('End promisifying github client.');

  github.authenticate({
    type: 'oauth',
    key: config.githubId,
    secret: config.githubSecret
  });

  // We get github id of github user.
  // Username is a changing variable, we cannot use it as a key in the database.
  var id = (yield github.user.getFromAsync({ user: username })).id;

  // We get the Oauth token in the database. If there is not, the user has
  // not signed up for Comm(nt|it)
  var user = yield users.getUser(id);

  if (!user) {
    var err = new CommentError(username + ' is not registered on commentit.io');

    throw err;
  }

  // We auth with the user token
  github.authenticate({
    type: 'oauth',
    token: user.token
  });

  var branchName;
  var file;
  if (user.settings.master) {
    branchName = origBranchName;
  } else {
    if (user.settings.group) {
      branchName = origBranchName + '_comments';
    } else {
      branchName = origBranchName + '_comments_' + path;
    }
    // We check the file in the origin branch
    try {
      file = yield github.repos.getContentAsync({
        user: owner,
        repo: repo,
        path: path,
        ref: origBranchName
      });
    } catch (err) {
      if (404 === err.code) {
        throw new CommentError('repository or file not found');
      }

      throw err;
    }
    // We get the new branch for comments. If it doesn't exist we create it.
    var branch;
    try {
      branch = yield github.repos.getBranchAsync({
        user: owner,
        repo: repo,
        branch: branchName
      });
    } catch (err) {
      if (404 !== err.code) {
        throw err;
      }

      branch = yield createCommentBranch(owner, repo, origBranchName, branchName);
    }
  }

  // We get the file in the new branch
  try {
    file = yield github.repos.getContentAsync({
      user: owner,
      repo: repo,
      path: path,
      ref: branchName
    });
  } catch (err) {
    if (404 === err.code) {
      throw new CommentError('repository or file not found');
    }

    throw err;
  }

  // We modify the file and commit it.
  if ('file' !== file.type) {
    throw new CommentError(file.name + ' is not a file but a ' + file.type);
  }

  debug('Got file ' + file.name + ' from ' + username + '/' + repo);

  var content;
  if (!page.id) {
    content = fileEditor.updateFrontMatter(file.content, comment);
  } else {
    content = utf8.decode(atob(file.content));
    var yaml = jsYaml.safeLoad(content);

    if ('object' !== typeof yaml) {
      yaml = {};
    }

    if (!Array.isArray(yaml[page.id])) {
      yaml[page.id] = [];
    }
    yaml[page.id].push(comment);

    content = jsYaml.safeDump(yaml).replace(/\n{3,}/, '\n\n\n');
    content = btoa(utf8.encode(content));
  }


  yield github.repos.updateFileAsync({
    user: owner,
    repo: repo,
    path: path,
    message: 'Comment by ' + authorString(comment.author),
    content: content,
    sha: file.sha,
    branch: branchName,
    committer: {
      name: 'Comm(ent|it)',
      email: 'contact@commentit.io'
    },
    author: {
      name: 'Comm(ent|it)',
      email: 'contact@commentit.io'
    }
  });
  debug('File updated');

  if (!user.settings.master) {
    // check if a PR is existing
    var pr = yield github.pullRequests.getAllAsync({
      user: username,
      repo: repo,
      base: origBranchName,
      head: branchName,
    });

    // comment we will put in the PR
    var bodyString = '**Date :** ' + comment.date.toString() + '\n' +
      '**Author :** ' + authorString(comment.author) + '\n' +
      '**Content :** ' + comment.content + '\n';

    // if PR exists, we add a comment
    if ('undefined' !== typeof pr[0] && pr[0].head.ref === branchName &&
    pr[0].base.ref === origBranchName) {
      debug('Got pull request');
      BPromise.promisifyAll(github.issues);
      yield github.issues.createCommentAsync({
        user: owner,
        repo: repo,
        number: pr[0].number,
        body: bodyString
      });
    } else {
      // else, we create the PR
      yield github.pullRequests.createAsync({
        user: owner,
        repo: repo,
        title: 'Comments for file ' + path + '.',
        body: bodyString,
        base: origBranchName,
        head: branchName
      });
    }

    debug('Made pull request');
  }

  redisClient.incr('commentCount');
  log.info({page: page, comment: comment}, 'posted comment');

  return user.settings.master ? 'committed' : 'pending';

  // local helper function. This is a closure as we are using the specific
  // github object used by the comment function.
  function createCommentBranch(owner, repo, origBranch, branch) {
    return co(function* () {
      debug('Creating comment branch');
      BPromise.promisifyAll(github.gitdata);

      var ref = yield github.gitdata.getReferenceAsync({
        user: owner,
        repo: repo,
        ref: 'heads/' + origBranch
      });

      var shaOrigbranch = ref.object.sha;
      debug('Sha for origin branch : ' + shaOrigbranch);

      ref = yield github.gitdata.createReferenceAsync({
        user: owner,
        repo: repo,
        ref: 'refs/heads/' + branch,
        sha: shaOrigbranch
      });

      var newBranch = yield github.repos.getBranchAsync({
        user: owner,
        repo: repo,
        branch: branch
      });

      debug('Created comment branch ' + branch);

      return newBranch;
    });
  }
}); // end GithubClient.protoype.comment()

// helper function
function authorString(author) {
  return author.displayName + (author.url ? ' (' + author.url + ')' : '');
}
