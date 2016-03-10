'use strict';

const sysPath = require('path');
const fs = require('fs');
const mediator = require('../mediator');
const modules = require('./modules');
const explore = require('./explore');
const helpers = require('./helpers');
const promisify = require('../helpers').promisify;

const dir = sysPath.dirname(sysPath.dirname(require.resolve('..')));
const readFile = promisify((path, callback) => fs.readFile(path, {encoding: 'utf8'}, callback));

const wrapInModule = (filePath, opts) => {
  if (opts == null) opts = {};
  if (opts.paths == null) {
    const ref = process.env.NODE_PATH;
    opts.paths = (ref != null ? ref.split(':') : void 0) || [];
  }
  if (opts.basedir == null) opts.basedir = process.cwd();

  filePath = sysPath.resolve(opts.basedir, filePath);

  return readFile(filePath).then(src => modules.wrap(filePath, src));
};

const brunchRe = /brunch/;

const needsProcessing = file => file.path.indexOf('node_modules') !== -1 &&
  (file.path.indexOf('.js') !== -1 || file.path.indexOf('.json') !== -1) &&
  !brunchRe.test(file.path) &&
  helpers.isPackage(file.path) ||
  exports.isNpm(file.path);

exports.exploreDeps = explore;
exports.wrapInModule = wrapInModule;
exports.loadInit = require('./init');
exports.needsProcessing = needsProcessing;
exports.processFiles = require('./process');

exports.isShim = path => path.indexOf(dir) === 0;
exports.isNpm = path => {
  if (!mediator.npmIsEnabled) return false;
  return path.indexOf('node_modules') >= 0 &&
    !brunchRe.test(path) && path.indexOf('.css') === -1 &&
    helpers.isPackage(path) ||
    path.indexOf(dir) === 0;
};

exports.isNpmJSON = path => {
  return exports.isNpm(path) && path.indexOf('.json') !== -1;
};

// exports.init = require('./init');
// exports.process = require('./process');
