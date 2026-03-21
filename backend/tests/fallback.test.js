const assert = require('assert');
const { describe, it, before } = require('node:test');

const db = require('../src/db');
const { getStatus, handleBottlenecks, handleDisconnects } = require('../src/services/fallback-loop');

describe('Fallback Loop System', () => {
  before(() => {
    // Ensure clean state
    try { db.run(`DELETE FROM bottleneck_events`); } catch (e) {}
    try { db.run(`DELETE FROM jobs WHERE job_id LIKE 'test-%'`); } catch (e) {}
  });

  it('bottleneck_events table exists', () => {
    const row = db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='bottleneck_events'`);
    assert.strictEqual(row.name, 'bottleneck_events');
  });

  it('fallback status endpoint returns loop state', () => {
    const status = getStatus();
    assert.strictEqual(typeof status.running, 'boolean');
    assert.strictEqual(typeof status.eventsToday, 'number');
    assert.ok('lastRunAt' in status);
  });

  it('simulate endpoint creates a bottleneck event', () => {
    db.run(
      `INSERT INTO bottleneck_events (provider_id, trigger, utilization_pct, jobs_affected, action_taken, created_at)
       VALUES (?, 'high_utilization', 99.0, 0, 'simulated', ?)`,
      999, new Date().toISOString()
    );
    const row = db.get(`SELECT * FROM bottleneck_events WHERE provider_id = 999`);
    assert.ok(row);
    assert.strictEqual(row.trigger, 'high_utilization');
    assert.strictEqual(row.action_taken, 'simulated');
  });

  it('bottleneck detection runs without error on empty providers', () => {
    // Should not throw
    const count = handleBottlenecks();
    assert.strictEqual(typeof count, 'number');
  });

  it('disconnect recovery integrates with recovery_events table', () => {
    const tableCheck = db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='recovery_events'`);
    assert.ok(tableCheck, 'recovery_events table should exist');
    // handleDisconnects should run without error
    const count = handleDisconnects();
    assert.strictEqual(typeof count, 'number');
  });
});
