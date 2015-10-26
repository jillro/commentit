/*jshint browser: true, node: false */
/* globals commentitUsername: true */
/* globals commentitRepo: true */
/* globals commentitPath: true */
/* globals commentitHost: true */
/* globals commentitId: true */
/* globals commentitDatafile: true */

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
  var host = ('undefined' === typeof commentitHost) ?
    'https://commentit.io' : commentitHost;

  var iframe = document.createElement('iframe');
  iframe.src = host + '/static/embed/dist/form.html';
  iframe.id = 'commentit-iframe';
  iframe.style.width = '100%';
  iframe.style.height = '150px';
  iframe.style['border-radius'] = '4px';
  iframe.style['background-clip'] = 'padding-box';
  iframe.style.border = '0px';
  iframe.style.padding = '0px';
  iframe.style.margin = '0px';
  document.getElementById('commentit').appendChild(iframe);

  window.addEventListener('message', function(event) {
    if ('commentit-ready' !== event.data) return;

    var p = document.createElement('p');
    p.style.display = 'none';
    document.getElementById('commentit').appendChild(p);

    var a = document.createElement('a');
    a.style.display = 'none';
    document.getElementById('commentit').appendChild(a);

    var linkColor = window.getComputedStyle(a).getPropertyValue('color');
    var textColor = window.getComputedStyle(p).getPropertyValue('color');
    var theme = (require('./yiq')(textColor) >= 128) ? 'dark' : 'light';
    var options = {
      'theme': theme,
      'link-color': linkColor,
      'username': commentitUsername,
      'repo': commentitRepo
    };
    if ('undefined' !== (typeof commentitPath)) {
      options.path = commentitPath;
    } else {
      if ('undefined' == (typeof commentitDatafile)) {
        options.datafile = 'comments';
      } else {
        options.datafile = commentitDatafile;
      }
      options.id = commentitId;
    }

    iframe.contentWindow.postMessage({ 'commentit-options' : options }, '*');
  });
})();
