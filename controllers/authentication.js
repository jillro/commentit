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
var crypto = require('crypto');
var BPromise = require('bluebird');
var express = require('express');
var FacebookStrategy = require('passport-facebook').Strategy;
var GithubStrategy = require('passport-github').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var passport = require('passport');
var router = express.Router();

var config = require('../config');
var github = require('../services/github');
var users = require('../services/users');
var Commenter = users.Commenter;
var log = require('../services/log');


/* Passport configuration */
passport.serializeUser(function(user, cb) {
  if (!user) return cb(null, null);

  if ('full' !== user.type) {
    return cb(null, user);
  }

  return cb(null, Number(user.id));
});

passport.deserializeUser(co.wrap(function* (user, cb) {
  if (!user) return cb(null, null);

  /* if user is not an id, it is just in memory */
  if ('number' !== (typeof user)) {
    return cb(null, user);
  }

  var id = user;
  try {
    user = yield users.getUser(id);
  } catch (err) {
    return cb(err);
  }

  if (!user) return cb(null, null);

  user.type = 'full';
  user.displayName = user.username;
  user.url = 'https://github.com/' + user.username;

  return cb(null, user);
}));

/*
 * This part is for connecting on Github and asking authorization so the user
 * can become a member
 */
passport.use('github', new GithubStrategy({
    clientID: config.githubId,
    clientSecret: config.githubSecret,
    callbackURL: config.host + '/login/callback',
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    co(function* () {
      var userLog = log.child({username: profile.username});
      // Check user exists
      var user = yield users.getUser(profile.id);

      if (!user && config.invitations) { // If the user is new, she needs an invitation to register.
        if (!req.session.invitation) {
          userLog.info('no invitation');

          return done(null, false, { message: 'You need an invitation.' });
        }

        try {
          userLog.info({code: req.session.invitation}, 'try using code');
          yield users.consumeInvitation(req.session.invitation);
        } catch (err) {
          if ('InvalidInvitationError' === err.name) {
            req.session.invalidInvitation = true;
            userLog.warn({code: req.session.invitation}, 'invalid code');

            return done(null, false, { message: err.message });
          }

          throw err;
        }

        delete req.session.invitation;
      }

      userLog.info('authenticated user');

      var email = yield github.getEmail(accessToken);

      user = {
        id: Number(profile.id),
        username : profile.username,
        email: email,
        token: accessToken,
        picture: profile._json.avatar_url ?
          profile._json.avatar_url + '&s=73' : gravatarFromEmail(yield github.getEmail(accessToken))
      };

      yield users.setUser(user);

      user.type = 'full';
      user.displayName = user.username;
      user.url = 'https://github.com/' + user.username;

      return done(null, user);
    }).catch(done);
  }
));

router.get('/login', passport.authenticate('github', { scope: ['user:email', 'public_repo'] }));
router.get(
  '/login/callback',
  passport.authenticate('github', {
    scope: ['user:email', 'public_repo'],
    failureRedirect: '/invitation'
  }),
  function(req, res) {
    return res.redirect('/');
  }
);

var postAuthMiddleware = function(req, res, next) {
  return res.redirect('/auth/confirm');
};

passport.use('github-nosave', new GithubStrategy({
    clientID: config.githubCommenterId,
    clientSecret: config.githubCommenterSecret,
    callbackURL: config.host + '/auth/github/callback'
  },
  co.wrap(function* (accessToken, refreshToken, profile, done) {
    var user = {
      type: 'github',
      displayName: profile.username,
      url: 'https://github.com/' + profile.username,
      picture : profile._json.avatar_url ?
        profile._json.avatar_url + '&s=73' : gravatarFromEmail(yield github.getEmail(accessToken))
    };

    log.info({user: user}, 'authenticated commenter');

    return done(null, user);
  })
));
router.get('/auth/github', passport.authenticate('github-nosave', {
  scope: ['user:email']
}));
router.get(
  '/auth/github/callback',
  passport.authenticate('github-nosave', { failureRedirect: '/auth/failure' }),
  postAuthMiddleware
);

passport.use(new TwitterStrategy({
  // TODO : update Here
    consumerKey: config.twitterKey,
    consumerSecret: config.twitterSecret,
    callbackURL: config.host + '/auth/twitter/callback'
  },
  function (accessToken, refreshToken, profile, done) {
    var user = {
      type: 'twitter',
      displayName: profile.username,
      url: 'https://twitter.com/' + profile.username,
      picture : profile.photos[0].value.replace('normal', 'bigger')
    };

    log.info({user: user}, 'authenticated commenter');

    return done(null, user);
  }
));
router.get('/auth/twitter', passport.authenticate('twitter'));
router.get(
  '/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/auth/failure' }),
  postAuthMiddleware
);

passport.use(new FacebookStrategy({
    clientID: config.fbId,
    clientSecret: config.fbSecret,
    callbackURL: config.host + '/auth/facebook/callback',
    enableProof: true
  },
  function(accessToken, refreshToken, profile, done) {
    var user = {
      type: 'facebook',
      displayName: profile.displayName,
      url: profile.profileUrl,
      picture : gravatarFromEmail(profile.emails[0].value)
    };

    log.info({user: user}, 'authenticated commenter');

    return done(null, user);
  }
));
router.get('/auth/facebook', passport.authenticate('facebook', {
  scope: ['public_profile', 'email'],
  display: 'popup'
}));
router.get(
  '/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/auth/failure' }),
  postAuthMiddleware
);

router.get('/auth/confirm', function(req, res) {
  if (!req.user) {
    return res.redirect('/');
  }

  return res.render('auth_confirm');
});

router.get('/auth/failure', function(req, res) {
  return res.render('auth_failure');
});

/*
 * API endpoint to get if user is connected
 */
router.get('/auth', function (req, res) {
  if (req.user) {
    return res.json(new Commenter(req.user));
  }

  return res.json({type: false});
});

// Logout
router.get('/logout', function(req, res) {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }

  log.info({user: req.user}, 'logout');
  req.logout();

  res.locals.fullyAuthenticated = false;

  return res.render('auth_confirm_logout');
});

function gravatarFromEmail(email) {
  var hash = crypto.createHash('md5').update(email).digest('hex');

  return 'https://www.gravatar.com/avatar/' + hash + '?s=73';
}

module.exports = router;
