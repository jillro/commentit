# Comm(ent|it)

![dependencies](https://david-dm.org/guilro/commentit.svg)

This repository contains the code of the application hosted at
[commentit.io](https://commentit.io). Comm(ent|it) uses the Github API and
Jekyll to help storing visitors comments directly in Github Pages repository.
You can contribute to make it better and more reliable.


# Contribute

## Installation

First, clone the repository, and copy the `config.js.dist` file.

    $ git clone https://github.com/guilro/commentit.git
    $ cd commentit
    $ cp config.js.dist config.js

Edit the new `config.js` file according to your local settings. Comm(ent|it)
depends on MongoDB and Redis. Both needs to be running on your server. You also
need to register your application on Github, Facebook and Twitter, and to set up
the identifiers and keys you get in the configuration. For development it is
sufficient to register only one application by provider. You do not need to fill
the part of `config.js` inside the `if (prod) {` block.

The project use [Grunt](http://gruntjs.com/) and [Bower](http://bower.io/) to
manage assets. You need to build them before running Comm(ent|it).

    $ npm run build

Then, you can run the application with

    $ npm start

Comm(ent|it) listen by default on port 3000, but you can change it by setting
the `PORT` environment variable.

## Runing tests

    $ npm test

The tests mainly address user storage. Feel free to write other tests if you add
features.
