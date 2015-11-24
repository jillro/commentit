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
var fileEditor = require('../services/file-editor');

describe('File editor', function() {
  it('should add comments to front matter without touching content', function(done) {
    var before = 'LS0tCmxheW91dDogcG9zdAp0aXRsZTogICJIZWxsbyBXb3JsZCEg5LiW55WM\n' +
                 '5aW9ISIKZGVzY3JpcHRpb246IE15IGZpcnN0IHBvc3QKZGF0ZTogICAyMDE1\n' +
                 'LTA4LTE3IDE5OjE1OjQwCmNhdGVnb3JpZXM6IGZpcnN0IHBvc3QKLS0tClRo\n' +
                 'aXMgcGVyc29uYWwgd2Vic2l0ZSBpcyBhIGxpdHRsZSBwcm9qZWN0IHRvIGlu\n' +
                 'dHJvZHVjZSBteXNlbGYgdG8gdGhlIHdvcmxkIG9mIHByb2dyYW1taW5nLCB3\n' +
                 'aGlsZSBlbmFibGluZyBtZSB0byBibG9nIGFib3V0IG15IHJhbmRvbSBpZGVh\n' +
                 'cyBhbmQgZXhwZXJpZW5jZXMuIEkgYW0gdG90YWxseSBuZXcgdG8gdGhpcywg\n' +
                 'YnV0IGhvcGVmdWxseSB0aGlzIGNhbiBidWlsZCBhIGxpdHRsZSBmb3VuZGF0\n' +
                 'aW9uIGluIHdlYiBkZXZlbG9wbWVudCBmcm9tIHdoaWNoIEkgY2FuIHVzZSB0\n' +
                 'byBhcHBseSBteSBpbnRlcmVzdHMuIAoKT24gYSBtYWNybyBsZXZlbCBJJ20g\n' +
                 'aW50ZXJlc3RlZCBpbiBjb250cmlidXRpbmcgdG8gYW4gZW52aXJvbm1lbnRh\n' +
                 'bGx5IHN1c3RhaW5hYmxlIGZ1dHVyZS4gSSdtIHNwZWNpZmljYWxseSBpbnRl\n' +
                 'cmVzdGVkIGluIENoaW5hJ3MgZGV2ZWxvcG1lbnQgb2YgYWx0ZXJuYXRpdmUg\n' +
                 'ZW5lcmd5IHN5c3RlbXMuCgpJIGdyYWR1YXRlZCBmcm9tIFVDTEEgaW4gMjAx\n' +
                 'NCwgYW5kIGFtIG5vdyBpbiBZdW5uYW4sIENoaW5hLiAKCiZuYnNwOyZuYnNw\n' +
                 'OwohW01lXSh7eyBreWxlZ3JheWNhciB9fS9hc3NldHMvbWUuanBnKQo8YnI+\n' +
                 'Jm5ic3A7Jm5ic3A7Jm5ic3A75LqR5Y2X5aSn55CG5rSx5rW3Cg==';

    var after = 'LS0tCmxheW91dDogcG9zdAp0aXRsZTogJ0hlbGxvIFdvcmxkISDkuJbnlYzl' +
                'pb0hJwpkZXNjcmlwdGlvbjogTXkgZmlyc3QgcG9zdApkYXRlOiAyMDE1LTA4' +
                'LTE3VDE5OjE1OjQwLjAwMFoKY2F0ZWdvcmllczogZmlyc3QgcG9zdApjb21t' +
                'ZW50czoKICAtIGF1dGhvcjoKICAgICAgdHlwZTogZnVsbAogICAgICBkaXNw' +
                'bGF5TmFtZToga3lsZWdyYXljYXIKICAgICAgdXJsOiAnaHR0cHM6Ly9naXRo' +
                'dWIuY29tL2t5bGVncmF5Y2FyJwogICAgICBwaWN0dXJlOiAnaHR0cHM6Ly9h' +
                'dmF0YXJzLmdpdGh1YnVzZXJjb250ZW50LmNvbS91LzE0Mjg3NzA2P3Y9MyZz' +
                'PTczJwogICAgY29udGVudDogJ1RoaXMgaXMgYSB0ZXN0IGNvbW1lbnQuICcK' +
                'ICAgIGRhdGU6IDIwMTUtMTEtMjNUMTM6MjQ6NTcuMDM3WgoKLS0tClRoaXMg' +
                'cGVyc29uYWwgd2Vic2l0ZSBpcyBhIGxpdHRsZSBwcm9qZWN0IHRvIGludHJv' +
                'ZHVjZSBteXNlbGYgdG8gdGhlIHdvcmxkIG9mIHByb2dyYW1taW5nLCB3aGls' +
                'ZSBlbmFibGluZyBtZSB0byBibG9nIGFib3V0IG15IHJhbmRvbSBpZGVhcyBh' +
                'bmQgZXhwZXJpZW5jZXMuIEkgYW0gdG90YWxseSBuZXcgdG8gdGhpcywgYnV0' +
                'IGhvcGVmdWxseSB0aGlzIGNhbiBidWlsZCBhIGxpdHRsZSBmb3VuZGF0aW9u' +
                'IGluIHdlYiBkZXZlbG9wbWVudCBmcm9tIHdoaWNoIEkgY2FuIHVzZSB0byBh' +
                'cHBseSBteSBpbnRlcmVzdHMuIAoKT24gYSBtYWNybyBsZXZlbCBJJ20gaW50' +
                'ZXJlc3RlZCBpbiBjb250cmlidXRpbmcgdG8gYW4gZW52aXJvbm1lbnRhbGx5' +
                'IHN1c3RhaW5hYmxlIGZ1dHVyZS4gSSdtIHNwZWNpZmljYWxseSBpbnRlcmVz' +
                'dGVkIGluIENoaW5hJ3MgZGV2ZWxvcG1lbnQgb2YgYWx0ZXJuYXRpdmUgZW5l' +
                'cmd5IHN5c3RlbXMuCgpJIGdyYWR1YXRlZCBmcm9tIFVDTEEgaW4gMjAxNCwg' +
                'YW5kIGFtIG5vdyBpbiBZdW5uYW4sIENoaW5hLiAKCiZuYnNwOyZuYnNwOwoh' +
                'W01lXSh7eyBreWxlZ3JheWNhciB9fS9hc3NldHMvbWUuanBnKQo8YnI+Jm5i' +
                'c3A7Jm5ic3A7Jm5ic3A75LqR5Y2X5aSn55CG5rSx5rW3Cg==';

    var comment = {
      author: {
        type: 'full',
        displayName: 'kylegraycar',
        url: 'https://github.com/kylegraycar',
        picture: 'https://avatars.githubusercontent.com/u/14287706?v=3&s=73'
      },
      content: 'This is a test comment. ',
      date: new Date('2015-11-23T13:24:57.037Z')
    };

    var newContent = fileEditor.updateFrontMatter(before, comment);
    assert.equal(after, newContent);

    return done();
  });
});
