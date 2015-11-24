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
var mongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var BPromise = require('bluebird');
BPromise.promisifyAll(require('mongodb'));
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport(require('../config').nodemailerOptions);
var uuid = require('node-uuid');
var he = require('he');

var config = require('../config');
var log = require('./log');

/**
 * @typedef Commenter
 * @property {string}  type        full, facebook, github, google
 * @property {string}  displayName Github username
 * @property {string}  url         Profile url
 * @property {string}  picture     Url of a profile picture
 */

var Commenter = function(user) {
  this.type = user.type;
  this.displayName = he.encode(user.displayName);
  this.url = user.url;
  this.picture = user.picture;
};


/**
 * @typedef User
 * @property {integer} id       Github id
 * @property {string}  username Github username
 * @property {string}  email    Github email
 * @property {string}  token    Github API token
 * @property {string}  picture  Picture URL
 */

/**
 * @typedef Settings
 * @property {boolean} anonymous Do the user accept anonymous comments.
 * @property {boolean} master    Do we commit directly on master (or gh-pages) branch.
 * @property {boolean} group     Do we put all comments in same PR.
 */

/**
 * @callback userCallback
 * @param    {Error}      err
 * @param    {User}       user
 */

function Repository() {
  var self = this;
  var url = config.dbUrl;

  this.connected = new Promise(function(resolve, reject) {
    return mongoClient.connect(url, function(err, db) {
      if (err) return reject(err);

      log.info('connection to mongodb server');

      self.db = db;
      self.users = db.collection('users');
      self.users.ensureIndex({ id: 1 });
      self.users.ensureIndex({ username: 1 });
      self.invitations = db.collection('invitations');
      self.invitations.ensureIndex({ email: 1 });
      self.invitations.ensureIndex({ code: 1 });

      return resolve(true);
    });
  });
}

/**
 * Store users info.
 * @param {User}          user Github user
 * @return {Promise<User>}  cb
 */
Repository.prototype.setUser = co.wrap(function* (user) {
  var self = this;

  var id = user.id;
  var username = user.username;
  var email = user.email;
  var token = user.token;
  var picture = user.picture;

  var userLog = log.child({username: username});

  if (!(id && username && token && email && picture)) {
    var err =  new Error('Can\'t save invalid user object : ' + JSON.stringify(user));
    err.name = 'TypeError';

    throw err;
  }

  user = yield this.users.findOneAsync({ id: id });

  if (!user || !user.settings) {
    // User is new
    user = {
      id: id,
      settings: { master: false, group: false }
    };
    userLog.info({username: username, token: token}, 'new user');
  }

  user.username = username;
  user.email = email;
  user.token = token;
  user.picture = picture;

  yield this.users.updateOneAsync({ id: id }, user, { upsert: true });

  this.users.deleteMany({ username: user.username, $not: { id: user.id }}, function(err) {});

  userLog.info({user: user}, 'user saved');

  return user;
});

/**
 * @param  {integer}         id Github Id
 * @return {Promise<User>}   cb
 */
Repository.prototype.getUser = co.wrap(function* (id) {
  var user = yield this.users.findOneAsync({ id: id });

  if (user) {
    delete user._id;

    return user;
  }

  return;
});

/**
 * @return {Promise<Number>}
 */
Repository.prototype.countUsers = co.wrap(function* () {
  return yield this.users.countAsync();
});

/**
 * @param  {Object}   options       Options
 * @param  {integer}  options.skip  Skip
 * @param  {integer}  options.limit Limit
 * @return {Promise<Array>}
 */
Repository.prototype.list = co.wrap(function* (options) {
  options = options | {};
  var users = yield this.users.find({}).skip(options.skip || 0).limit(options.limit || 0).toArrayAsync();

  for (var i = 0; i < users.length; i++) {
    delete users[i]._id;
  }

  return users;
});

Repository.prototype.setOption = co.wrap(function *(id, option, value) {
  var set = {};
  set['settings.' + option] = value;

  yield this.users.updateOneAsync({ id: id }, { $set: set });

  log.info({id: id, option: option, value: value}, 'saved option');

  return;
});

Repository.prototype.addInvitation = co.wrap(function* (email) {
  var invitation = yield this.invitations.findOneAsync({email : email});
  if (invitation) {
    var message = 'Invitation already asked.';

    if (invitation.sent) { // If invitation has already been sent we sent it again.
      transporter.sendMail({
        from: 'invitation@commentit.io',
        to: invitation.email,
        subject: 'Your invitation to Comm(ent|it) !',
        text: 'http://commentit.io/invitation/' + invitation.code
      }, function(err) {
        if (err) throw (err);
      });

      message = 'You already asked an invitation and we sent it to you. ' +
      ' In case you did not receive it, we sent it again.';

    log.info({email: email, code: invitation.code}, 're-sent invitation');

    }

    var err = new Error(message);
    err.name = 'InvitationAskedError';

    throw err;
  }

  var code = uuid.v4();
  invitation = yield this.invitations.insertOneAsync({email: email, code: code, sent: false, used: false});

  log.info({email: email, code: invitation.code}, 'add pending invitation');

  return code;
});

Repository.prototype.sendNextInvitation = co.wrap(function* () {
  var invitation = yield this.invitations.findOneAsync({ sent: false });

  if (invitation) {
    transporter.sendMail({
      from: 'invitation@commentit.io',
      to: invitation.email,
      subject: 'Your invitation to Comm(ent|it) !',
      text: 'http://commentit.io/invitation/' + invitation.code
    }, function(err) {
      log.error(err);
    });

    yield this.invitations.updateOneAsync({ _id: invitation._id }, { $set: { sent: true } });
    log.info({email: invitation.email, code: invitation.code}, 'invitation sent');

    return;
  }

  log.info('no pending invitation.');
});

Repository.prototype.sendInvitation = co.wrap(function* (email) {
  var invitation = yield this.invitations.findOneAsync({ email: email });

  if (!invitation) {
    throw new Error('User does not exists.');
  }

  transporter.sendMail({
    from: 'invitation@commentit.io',
    to: email,
    subject: 'Your invitation to Comm(ent|it) !',
    text: 'http://commentit.io/invitation/' + invitation.code
  });

  yield this.invitations.updateOneAsync({ email: email }, { $set: { sent: true } });

  log.info({email: invitation.email, code: invitation.code}, 'invitation sent');

  return;
});

Repository.prototype.consumeInvitation = co.wrap(function* (code) {
  var invitation = yield this.invitations.findOneAsync({ code: code, used: false});

  if (!invitation) {
    var err = new Error('This invitation does not exists or has already been used.');
    err.name = 'InvalidInvitationError';

    throw err;
  }

  yield this.invitations.updateOneAsync({ code: code, used: false }, { $set: { used: true } });

  log.info({code: code}, 'invitation consumed.');

  return;
});

module.exports = new Repository();
module.exports.Commenter = Commenter;
