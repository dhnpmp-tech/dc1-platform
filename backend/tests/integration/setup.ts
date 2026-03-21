/**
 * DC1 Integration Test Setup
 * Helpers for creating test data with unique prefixes.
 * All external services (Supabase, Docker, MC API) are mocked.
 */

const crypto = require('crypto');

// ── Test Run Prefix ──────────────────────────────────────────────────────────
const TEST_RUN_ID = `test_sync_${crypto.randomUUID().slice(0, 8)}`;
let counter = 0;

function testId(prefix = 'id') {
  return `${TEST_RUN_ID}_${prefix}_${++counter}`;
}

function testRunId() {
  return TEST_RUN_ID;
}

// ── Mock fetch for Mission Control API ───────────────────────────────────────
const mcHandlers = new Map();

function clearMcEndpoints() {
  mcHandlers.clear();
}

// ── Billing Utility Functions (shared across test files) ─────────────────────
/** Calculate cost in halala for a given number of minutes at a given hourly rate */
function costForMinutes(minutes, ratePerHourHalala) {
  return Math.round((minutes * ratePerHourHalala) / 60);
}

/** Split a total halala amount into provider (75%) and DC1 (25%) shares */
function splitCost(total) {
  const provider = Math.round((total * 75) / 100);
  const dc1 = total - provider;
  return { provider, dc1 };
}

// ── Test Data Factories ──────────────────────────────────────────────────────
function createTestWallet(userId, balanceHalala = 100_000) {
  return {
    userId: userId || testId('user'),
    total: balanceHalala,
    reserved: 0,
    available: balanceHalala,
  };
}

function createTestGPU(overrides = {}) {
  return {
    id: overrides.id || testId('gpu'),
    providerId: overrides.providerId || testId('provider'),
    gpuModel: overrides.gpuModel || 'NVIDIA A100',
    vramGb: overrides.vramGb || 80,
    ratePerHour: overrides.ratePerHour || 2.5,
    reliability: overrides.reliability || 0.99,
    status: overrides.status || 'available',
  };
}

function createTestJob(overrides = {}) {
  return {
    renterId: overrides.renterId || testId('renter'),
    dockerImage: overrides.dockerImage || 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
    jobCodePath: overrides.jobCodePath || '/tmp/test-job-code',
    requiredVramGb: overrides.requiredVramGb || 24,
    estimatedHours: overrides.estimatedHours || 2,
    maxBudgetUsd: overrides.maxBudgetUsd || 10,
    gpuCount: overrides.gpuCount || 1,
    metadata: overrides.metadata || { env: 'test' },
  };
}

function createTestBillingSession(overrides = {}) {
  return {
    id: overrides.id || testId('session'),
    jobId: overrides.jobId || testId('job'),
    renterId: overrides.renterId || testId('renter'),
    providerId: overrides.providerId || testId('provider'),
    ratePerHourHalala: overrides.ratePerHourHalala || 250,
    startedAt: overrides.startedAt || new Date(),
    reservationId: testId('reservation'),
    reservedAmountHalala: (overrides.ratePerHourHalala || 250) * 24,
    status: overrides.status || 'active',
  };
}

function cleanupTestData() {
  clearMcEndpoints();
  counter = 0;
}

module.exports = {
  testId,
  testRunId,
  costForMinutes,
  splitCost,
  createTestWallet,
  createTestGPU,
  createTestJob,
  createTestBillingSession,
  cleanupTestData,
};
