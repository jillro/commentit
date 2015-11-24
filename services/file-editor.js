'use strict';

var atob = require('atob');
var btoa = require('btoa');
var debug = require('debug')('commentit:file-editor');
var jsYaml = require('js-yaml');
var utf8 = require('utf8');

var CommentError = require('./github').CommentError;

exports.updateFrontMatter = function(content, comment) {
  content = utf8.decode(atob(content));
  var frontMatter = {};
  var regex = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;
  var results = regex.exec(content);
  var frontMatterString = results[1];
  var yamlOrJson = results[2];
  debug('Current front matter is\n' + frontMatterString);

  if('' === results[1] || 'undefined' === typeof results[1]) {
    throw new CommentError('no front matter in the file');
  }

  if(yamlOrJson.charAt(0) === '{') {
    frontMatter = JSON.parse(yamlOrJson);
  } else {
    frontMatter = jsYaml.safeLoad(yamlOrJson);
  }

  if (!frontMatter.comments) {
    frontMatter.comments = [];
  }

  debug('Current comments are ' + JSON.stringify(frontMatter.comments));

  frontMatter.comments.push(comment);


  var newYaml = jsYaml.safeDump(frontMatter).replace(/\n{3,}/, '\n\n\n');

  content = content.replace(/^(-{3}(?:\n|\r))([\w\W]+?)((?:\n|\r)-{3})/, function(match, p1, p2, p3, offset, string) {
    return (p1 + newYaml + p3);
  });

  return btoa(utf8.encode(content));
};
