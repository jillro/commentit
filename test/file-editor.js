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

    var after = 'LS0tCmxheW91dDogcG9zdAp0aXRsZTogSGVsbG8g' +
                'V29ybGQhIOS4lueVjOWlvSEKZGVzY3JpcHRpb246' +
                'IE15IGZpcnN0IHBvc3QKZGF0ZTogMjAxNS0wOC0x' +
                'N1QxOToxNTo0MC4wMDBaCmNhdGVnb3JpZXM6IGZp' +
                'cnN0IHBvc3QKY29tbWVudHM6CiAgLSBhdXRob3I6' +
                'CiAgICAgIHR5cGU6IGZ1bGwKICAgICAgZGlzcGxh' +
                'eU5hbWU6IGt5bGVncmF5Y2FyCiAgICAgIHVybDog' +
                'J2h0dHBzOi8vZ2l0aHViLmNvbS9reWxlZ3JheWNh' +
                'cicKICAgICAgcGljdHVyZTogJ2h0dHBzOi8vYXZh' +
                'dGFycy5naXRodWJ1c2VyY29udGVudC5jb20vdS8x' +
                'NDI4NzcwNj92PTMmcz03MycKICAgIGNvbnRlbnQ6' +
                'ICdUaGlzIGlzIGEgdGVzdCBjb21tZW50LiAnCiAg' +
                'ICBkYXRlOiAyMDE1LTExLTIzVDEzOjI0OjU3LjAz' +
                'N1oKCi0tLQpUaGlzIHBlcnNvbmFsIHdlYnNpdGUg' +
                'aXMgYSBsaXR0bGUgcHJvamVjdCB0byBpbnRyb2R1' +
                'Y2UgbXlzZWxmIHRvIHRoZSB3b3JsZCBvZiBwcm9n' +
                'cmFtbWluZywgd2hpbGUgZW5hYmxpbmcgbWUgdG8g' +
                'YmxvZyBhYm91dCBteSByYW5kb20gaWRlYXMgYW5k' +
                'IGV4cGVyaWVuY2VzLiBJIGFtIHRvdGFsbHkgbmV3' +
                'IHRvIHRoaXMsIGJ1dCBob3BlZnVsbHkgdGhpcyBj' +
                'YW4gYnVpbGQgYSBsaXR0bGUgZm91bmRhdGlvbiBp' +
                'biB3ZWIgZGV2ZWxvcG1lbnQgZnJvbSB3aGljaCBJ' +
                'IGNhbiB1c2UgdG8gYXBwbHkgbXkgaW50ZXJlc3Rz' +
                'LiAKCk9uIGEgbWFjcm8gbGV2ZWwgSSdtIGludGVy' +
                'ZXN0ZWQgaW4gY29udHJpYnV0aW5nIHRvIGFuIGVu' +
                'dmlyb25tZW50YWxseSBzdXN0YWluYWJsZSBmdXR1' +
                'cmUuIEknbSBzcGVjaWZpY2FsbHkgaW50ZXJlc3Rl' +
                'ZCBpbiBDaGluYSdzIGRldmVsb3BtZW50IG9mIGFs' +
                'dGVybmF0aXZlIGVuZXJneSBzeXN0ZW1zLgoKSSBn' +
                'cmFkdWF0ZWQgZnJvbSBVQ0xBIGluIDIwMTQsIGFu' +
                'ZCBhbSBub3cgaW4gWXVubmFuLCBDaGluYS4gCgom' +
                'bmJzcDsmbmJzcDsKIVtNZV0oe3sga3lsZWdyYXlj' +
                'YXIgfX0vYXNzZXRzL21lLmpwZykKPGJyPiZuYnNw' +
                'OyZuYnNwOyZuYnNwO+S6keWNl+Wkp+eQhua0sea1' +
                'two=';

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
    assert.equal(newContent, after);

    return done();
  });
});
