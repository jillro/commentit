/*global describe, it */

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

var assert = require('assert');
var users = require('../services/users');

describe('User repository', function() {
  it('should connect to the database in less than 1s', function(done) {
    setTimeout(function() {
      assert(users.db);

      users.db.collection('users').drop(function(err, reply) {
        if (err) return done(err);

        return done();
      });
    }, 1000);
  });

  var octocat = {
    id: 1,
    email: 'email@example',
    username: 'octocat',
    token: 'supertoken',
    picture: 'http://avatar.example.com/'
  };

  var octocatUser = octocat;
  octocatUser.settings = { master: false, group: false };

  describe('#setUser', function() {
    it('should save octocat', function(done) {
      return users.setUser(octocat).then(function(user) {
        assert.deepEqual(user, octocatUser);
        return done();
      }).catch(done);
    });
  });

  describe('#getUser', function() {
    it('should get octocat', function(done) {
      return users.getUser(1).then(function(user) {
        assert.deepEqual(user, octocatUser);
        return done();
      }).catch(done);
    });

    it('should get nothing else', function(done) {
      return users.getUser(2).then(function(user) {
        assert.equal('undefined', typeof user);
        return done();
      }).catch(done);
    });
  });

  describe('#list', function() {
    it('should give a list with octocat inside', function(done) {
      return users.list().then(function(list) {
        assert.deepEqual(
          octocatUser,
          list.filter(function(user) { return (1 === user.id); })[0]
        );
        return done();
      }).catch(done);
    });
  });
});
