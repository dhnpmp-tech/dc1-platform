#!/usr/bin/env node
'use strict';

const { runJobVolumeCleanup } = require('../services/cleanup');

try {
  const stats = runJobVolumeCleanup();
  console.log(`[cleanup-volume] done attempted=${stats.attempted} deleted=${stats.deleted} failed=${stats.failed}`);
  process.exit(0);
} catch (error) {
  console.error('[cleanup-volume] failed:', error.message);
  process.exit(1);
}
