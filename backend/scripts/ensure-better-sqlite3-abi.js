#!/usr/bin/env node

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

function log(message) {
  process.stdout.write(`[native-check] ${message}\n`);
}

function runNpmRebuild() {
  log('Rebuilding better-sqlite3 for current Node ABI...');

  const result = spawnSync('npm', ['rebuild', 'better-sqlite3'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm rebuild better-sqlite3 failed with exit code ${result.status}`);
  }
}

function clearBetterSqlite3FromCache() {
  for (const moduleId of Object.keys(require.cache)) {
    if (moduleId.includes(`${path.sep}better-sqlite3${path.sep}`)) {
      delete require.cache[moduleId];
    }
  }
}

function validateLoad() {
  try {
    require('better-sqlite3');
    log(`better-sqlite3 load OK (NODE_MODULE_VERSION=${process.versions.modules}).`);
    return;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const likelyAbiMismatch =
      message.includes('NODE_MODULE_VERSION') ||
      message.includes('was compiled against a different Node.js version');

    if (!likelyAbiMismatch) {
      throw error;
    }

    log(`Detected ABI mismatch: ${message}`);
    runNpmRebuild();
    clearBetterSqlite3FromCache();
    require('better-sqlite3');
    log(`better-sqlite3 rebuilt and verified for NODE_MODULE_VERSION=${process.versions.modules}.`);
  }
}

validateLoad();
