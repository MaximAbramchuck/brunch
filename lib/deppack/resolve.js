'use strict';

const browserResolve = require('browser-resolve');
const trueCasePath = require('true-case-path');
const _glob = require('glob');
const glob = require('../helpers').promisify(_glob);
const moduleNaming = require('./module-naming');
const helpers = require('./helpers');
const shims = require('./shims');

let modMap;

const cleanMod = (npmConfig, mod) => npmConfig.nameCleaner(mod.split('.').slice(0, -1).join('.'));

const addToModMap = (npmConfig, mod) => {
  const name = cleanMod(npmConfig, mod);
  modMap[name] = mod;
};

const noPackage = npmConfig => x => npmConfig.packages[x] == null;

const buildModMap = npmConfig => {
  // this is needed to not throw on app-wise requires
  // note that fileList.files can't be used because it's not fully populated until the first compilation
  const topPaths = npmConfig.paths.watched.join(',');
  return glob(`{${topPaths}}/**/*`).then(mods => {
    const modMap0 = mods.reduce((map, mod) => {
      const name = cleanMod(npmConfig, mod);
      map[name] = mod;
      return map;
    }, {});

    const shimModMap = shims.emptyShims.filter(noPackage(npmConfig)).reduce((acc, shim) => {
      acc[shim] = shims.makeSpecialShimFname(shim);
      return acc;
    }, {});

    const shimFileMap = Object.keys(shims.fileShims).filter(noPackage(npmConfig)).reduce((acc, shim) => {
      acc[shim] = shims.fileShims[shim];
      return acc;
    }, {});

    modMap = Object.assign({}, modMap0, shimModMap, shimFileMap);
  });
};

const resolveErrorRe = /Cannot find module '(.+)' from '(.+)'/;
const friendlyRequireError = (npmConfig, mod, opts, err) => {
  const topLevel = moduleNaming.getModuleRootName(mod);
  if (resolveErrorRe.test(err.message)) {
    const data = err.message.match(resolveErrorRe);
    const mod = data[1];
    const src = data[2];
    const isGlob = opts.filename === helpers.globalPseudofile;
    err = isGlob ? `Could not load global module '${mod}'.` : `Could not load module '${mod}' from '${src}'.`;

    if (topLevel === '.' || topLevel === '..') {
      err += ' Make sure the file actually exists.';
    } else if (noPackage(npmConfig)(topLevel)) {
      err += ` Possible solution: add '${topLevel}' to package.json and \`npm install\`.`;
    } else {
      if (npmConfig.overrides[mod]) {
        err += ' Possible solution: run `npm install` and check your overrides in package.json.';
      } else {
        err += ' Possible solution: run `npm install`.';
      }
    }
  }

  err = new Error(err);
  err.code = 'Resolving deps';
  return err;
};

const checkImproperCase = (mod, opts, res) => {
  if (res !== trueCasePath(res)) {
    const err = new Error(`Improperly-cased require: '${mod}' in ${opts.filename}`);
    err.code = 'Resolving deps';
    return err;
  }
};

const resolve = (npmConfig, mod, opts, cb) => {
  Object.assign(opts, {packageFilter: (pkg => helpers.applyPackageOverrides(pkg, npmConfig)), modules: modMap, extensions: ['.js', '.json']});
  mod = npmConfig.npm.aliases && npmConfig.npm.aliases[mod] || mod;
  browserResolve(mod, opts, (err, res) => {
    if (err) {
      return cb(friendlyRequireError(npmConfig, mod, opts, err));
    }

    const caseError = checkImproperCase(mod, opts, res);
    if (caseError) {
      return cb(caseError);
    }

    cb(null, res);
  });
};

exports.resolve = resolve;
exports.buildModMap = buildModMap;
exports.addToModMap = addToModMap;
