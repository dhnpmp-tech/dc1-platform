/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Use an in-memory SQLite DB for all tests — keeps tests isolated from production data
  testEnvironmentOptions: {},
  globals: {},
  // Set DC1_DB_PATH before any module is loaded in each test worker
  setupFiles: ['<rootDir>/tests/jest-setup.js'],
  // Run tests sequentially (SQLite in-memory is per-process)
  testPathIgnorePatterns: ['/node_modules/'],
};
