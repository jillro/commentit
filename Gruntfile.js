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

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    inline: {
      dist: {
        options: {
          cssmin: true,
          uglify: true
        },
        src: 'static/embed/src/form.html',
        dest: 'static/embed/dist/form.html'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'static/embed/src/commentit.bundle.js',
        dest: 'static/embed/dist/commentit.js'
      }
    },
    cssmin: {
      target: {
        files: {
          'static/css/style.min.css': ['static/css/style.css']
        }
      }
    },
    browserify: {
      dist: {
        files: {
          'static/embed/src/commentit.bundle.js': ['static/embed/src/commentit.js'],
          'static/embed/src/form.bundle.js': ['static/embed/src/form.js']
        }
      }
    },
    watch: {
      scripts: {
        files: ['static/embed/src/*'],
        tasks: ['default']
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-inline');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('default', ['browserify', 'uglify', 'cssmin', 'inline']);
};
