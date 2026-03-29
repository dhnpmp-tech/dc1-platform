'use strict';

const CANONICAL_PROVIDER_OSES = new Set(['windows', 'linux', 'mac', 'darwin']);

function normalizeProviderOs(value) {
  if (typeof value !== 'string') return null;

  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  if (raw === 'darwin') return 'darwin';

  if (
    raw === 'windows' ||
    raw === 'windows 10' ||
    raw === 'windows 11' ||
    raw === 'windows 10/11' ||
    raw === 'win' ||
    raw === 'win10' ||
    raw === 'win11'
  ) {
    return 'windows';
  }

  if (
    raw === 'linux' ||
    raw === 'other linux' ||
    raw.startsWith('ubuntu') ||
    raw.includes('linux')
  ) {
    return 'linux';
  }

  if (
    raw === 'mac' ||
    raw === 'macos' ||
    raw === 'mac os' ||
    raw === 'mac os x' ||
    raw === 'osx'
  ) {
    return 'mac';
  }

  return null;
}

module.exports = {
  CANONICAL_PROVIDER_OSES,
  normalizeProviderOs,
};
