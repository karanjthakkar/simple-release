#!/usr/bin/env node
'use strict';

var meow = require('meow');
var list = require('cli-list');
var gens = list(process.argv.slice(2));
var pkg = require('../package.json');
var simple = require('./');

var cli = gens.map(function (gen) {
  var minicli = meow({
    help: false,
    pkg: pkg,
    argv: gen
  });
  var opts = minicli.flags;
  var args = minicli.input;
  return { opts: opts, args: args };
});

var firstCmd = cli[0] || { opts: {}, args: {} };
var cmd = firstCmd.args[0];
var cmd1 = firstCmd.args[1] || '';

if (cmd === 'init') {
  simple.init();
} else if (cmd === 'release') {
  var supportedReleaseTypes = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'];
  if (supportedReleaseTypes.indexOf(cmd1.toLowerCase()) > -1) {
    simple.release(cmd1);
  } else if (cmd1 === '') {
    simple.release('patch');
  } else {
    console.log('Release type not supported.')
  }
} else if (firstCmd.opts.h || firstCmd.opts.help) {
  const help = `
    Usage:

    /* Run first time to initialize project */
    $ simple init


    /* Run for every subsequent releases
     * 'type' is a semver release type
     * Suported values for type: major, premajor, minor, preminor, patch, prepatch, or prerelease
     * Default type is 'patch'
     */
    $ simple release <type>

  `;
  console.log(help);
} else {
  console.log('Option not recognized.');
}