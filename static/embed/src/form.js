/* jshint node: false, browser: true, devel: true, multistr: true */

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

(function() {
  var host = document.location.origin;
  var form = window.document.getElementById('form');
  var textarea = form.getElementsByTagName('textarea')[0];
  var submit = document.getElementById('submit');
  var pendingRequest = false;
  var options;

  window.addEventListener('message', function(event) {
    if ('undefined' === typeof event.data['commentit-options']) return;
    textarea.addEventListener('focus', checkAuth);
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (pendingRequest) return false;

      pendingRequest = true;
      submitComment();
      return false;
    }, false);

    options = event.data['commentit-options'];
    var linkColor = options['link-color'];
    var textColor;
    var styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
    var styleSheet = styleEl.sheet;
    styleSheet.insertRule('a, a:hover, a:active { color: ' + linkColor + '}', 0);
    styleSheet.insertRule('#submit { background-color: ' + linkColor + '}', 0);
    console.log(require('./yiq')(linkColor));
    if (require('./yiq')(linkColor) >= 128) {
      styleSheet.insertRule('#submit { color: #333; }', 0);
    }
    if ('dark' === options.theme) {
      styleSheet.insertRule('body { color: #FFF }', 0);
      styleSheet.insertRule('.text-muted { color: #BBB }', 0);
    }
    form.style.display = 'block';
  }, false);
  window.parent.postMessage('commentit-ready', '*');

  /**
   * Check authentication state and update UI
   */
  function checkAuth() {
    /* AJAX request to commentit.io */
    var r = new XMLHttpRequest();
    r.withCredentials = true;
    r.open('GET', host + '/auth', true);
    r.onerror = function() {
      return error('could not connect to comm(ent|it) server.');
    };
    r.onreadystatechange = function () {
      if (r.readyState != 4 || r.status != 200) return;

      var user = JSON.parse(r.responseText);
      var html;
      /* if not connected */
      if (false === user.type) {
        /* display signin toolbar */
        html = ' | Please sign-in with ' +
          '<a href="' + host + '/auth/github" id="auth-github" target="commentit-login">' +
          '<i class="fa fa-github"></i> github</a>, ' +
          '<a href="' + host + '/auth/twitter" id="auth-twitter" target="commentit-login">' +
          '<i class="fa fa-twitter"></i> twitter</a> or ' +
          '<a href="' + host + '/auth/facebook" id="auth-facebook" target="commentit-login">' +
          '<i class="fa fa-facebook"></i> facebook</a>';
        document.getElementById('authinfo').innerHTML = html;
        /* link button to events */
        ['facebook', 'github', 'twitter'].forEach(function(type) {
          document.getElementById('auth-' + type).addEventListener('click', function(e) {
            e.preventDefault(e);
            openloginPopup(type);

            return false;
          }, false);
          submit.style.display = 'none';
        });
        /* remove picture if present */
        var pictureImg = document.getElementById('picture').getElementsByTagName('img')[0];
        if (pictureImg) {
          document.getElementById('picture').removeChild(pictureImg);
          document.getElementById('textarea').style.paddingLeft = '2px';
        }
      } else if (-1 !== ['full', 'facebook', 'github', 'twitter'].indexOf(user.type)) {
        /* if connected */
        html = '| signed-in as <a href="' + user.url + '"><strong>' + user.displayName + '</strong></a>' +
        ('full' !== user.type ? ' with ' + user.type : ' with your commentit.io account') +
        ' | <a href="' + host + '/logout" target="commentit-login" id="auth-logout">logout <i class="fa fa-sign-out"></i></a>';
        document.getElementById('authinfo').innerHTML = html;
        /* picture */
        html = '<img src="' + user.picture + '" height="73" width="73" alt="picure">';
        document.getElementById('picture').innerHTML = html;
        document.getElementById('textarea').style.paddingLeft = '84px';
        /* logout button */
        document.getElementById('auth-logout').addEventListener('click', function(e) {
          e.preventDefault(e);
          logout();

          return false;
        }, false);
        submit.style.display = 'block';
      }

      textarea.focus();

      return;
    };
    r.send();

    return false;
  }

  function submitComment() {
    document.getElementById('submit').disabled = true;
    document.getElementById('submit').innerHTML = '<i class="fa fa-spinner fa-pulse"></i> Post comment';
    var r = new XMLHttpRequest();
    r.withCredentials = true;
    r.open('POST', host + '/comment/csrf', true);
    r.onerror = function() {
      pendingRequest = false;

      return error('could not connect to comm(ent|it) server.');
    };
    r.onreadystatechange = function () {
      if (r.readyState != 4) return;

      if (r.status >= 400) {
        return error('please try again later');
      }

      var csrf = r.responseText;
      var data = {
        username: options.username,
        content: textarea.value,
        csrf: csrf
      };
      if (options.path) {
        data.path = options.path;
      } else {
        data.id = options.id;
        data.file = options.datafile;
      }
      data = JSON.stringify(data);
      var url = [host, 'comment', options.repo].join('/');

      var r2 = new XMLHttpRequest();
      r2.withCredentials = true;
      r2.open('POST', url, true);
      r2.setRequestHeader('Content-type', 'application/json');
      r2.onerror = function() {
        return error('could not connect to comm(ent|it) server.');
      };
      r2.onreadystatechange = function() {
        if (r2.readyState != 4) return;

        if (r2.status >= 400) {
          return error(r2.responseText);
        }

        return sent(r2.responseText);
      };
      r2.send(data);
    };
    r.send();
  }

  /**
   * Logout
   */
  function logout() {
    var r = new XMLHttpRequest();
    r.withCredentials = true;
    r.open('GET', host + '/logout', true);
    r.onreadystatechange = function () {
      if (r.readyState != 4 || r.status != 200) return;
      checkAuth();
    };
    r.onerror = function() {
      return error('could not connect to comm(ent|it) server.');
    };

    r.send();

    return false;
  }

  /**
   * open login popup
   * @param  {string} facebook|google|github|full
   * @return {[type]}      [description]
   */
  function openloginPopup(type) {
    window.open(
      host + '/auth/' + type,
      'Comm(ent|it) - Login',
      'height=500,width=500,resizable,scrollbars,status'
    );

   window.addEventListener('message', function receiveMessage(event) {
      if (event.origin !== host || 'commentit-login-success' !== event.data) return;

      checkAuth();
      window.removeEventListener('message', receiveMessage);
    }, false);
  }


  function error(msg) {
    successDiv('<i class="fa fa-4x fa-exclamation-circle"></i><br>Error: ' + msg);
  }

  function sent(state) {
    if ('pending' === state) {
      successDiv('Your comment has been submitted. It will appear when the site owner approve it.');
    } else if ('committed' === state) {
      successDiv('Your comment has been submitted. It may take a while to appear.');
    }
  }

  function successDiv(msg) {
    var body = form.parentNode;
    form.parentNode.removeChild(form);
    var div = document.createElement('div');
    div.id = 'success';
    div.innerHTML = msg;
    body.insertBefore(div, null);
  }
})();
