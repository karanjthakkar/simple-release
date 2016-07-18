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

if (cmd === 'init') {
  simple.init();
} else if (cmd === 'release') {
  simple.release();
} else if (firstCmd.opts.h || firstCmd.opts.help) {
  const help = `
    Usage:

      $ simple init      // Run first time to initialize project

      $ simple release   // Run for every subsequent releases
      
  `;
  console.log(help);
} else {
  console.log('Option not recognized.');
}