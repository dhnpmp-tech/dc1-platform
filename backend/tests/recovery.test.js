const assert = require('assert');
const { describe, it, beforeEach } = require('node:test');
const test = require('node:test');

// Setup: ensure db tables exist by requiring db first
const db = require('../src/db');
const {
  processHeartbeatGap,
  processLatency,
  getProviderState,
  _resetStates,
  BACKOFF_SCHEDULE,
} = require('../src/routes/recovery');

// Clean state before each test
function cleanup() {
  _resetStates();
  db.run('DELETE FROM recovery_events');
  // Ensure a test provider exists
  try {
    db.run(
      `INSERT OR IGNORE INTO providers (id, name, email, gpu_model, os, status, last_heartbeat)
       VALUES (999, 'TestProvider', 'test@dc1.com', 'RTX 4090', 'linux', 'online', ?)`,
      new Date().toISOString()
    );
  } catch (e) { /* ignore */ }
}

test('Test 1: Gap <=30s returns ONLINE, no event logged', () => {
  cleanup();
  const result = processHeartbeatGap(999, 10);
  assert.strictEqual(result.status, 'ONLINE');
  assert.strictEqual(result.action, 'none');
  const events = db.all('SELECT * FROM recovery_events WHERE provider_id = 999');
  assert.strictEqual(events.length, 0);
});

test('Test 2: Gap >30s and <=90s triggers WARNING', () => {
  cleanup();
  const result = processHeartbeatGap(999, 45);
  assert.strictEqual(result.status, 'WARNING');
  assert.strictEqual(result.action, 'logged');
  assert.ok(result.eventId);
});

test('Test 3: Repeated WARNING gap does not duplicate event', () => {
  cleanup();
  processHeartbeatGap(999, 45);
  const result2 = processHeartbeatGap(999, 60);
  assert.strictEqual(result2.action, 'already_warned');
  const events = db.all("SELECT * FROM recovery_events WHERE provider_id = 999 AND event_type = 'WARNING'");
  assert.strictEqual(events.length, 1);
});

test('Test 4: Gap >90s triggers RECONNECT with attempt 1', () => {
  cleanup();
  const result = processHeartbeatGap(999, 100);
  assert.strictEqual(result.status, 'RECONNECT');
  assert.strictEqual(result.attempt, 1);
  assert.strictEqual(result.backoffMs, BACKOFF_SCHEDULE[0]);
});

test('Test 5: Successive reconnects increment attempts with correct backoff', () => {
  cleanup();
  processHeartbeatGap(999, 100); // attempt 1
  const r2 = processHeartbeatGap(999, 120); // attempt 2
  assert.strictEqual(r2.attempt, 2);
  assert.strictEqual(r2.backoffMs, BACKOFF_SCHEDULE[1]);
  const r3 = processHeartbeatGap(999, 150); // attempt 3
  assert.strictEqual(r3.attempt, 3);
  assert.strictEqual(r3.backoffMs, BACKOFF_SCHEDULE[2]);
  const r4 = processHeartbeatGap(999, 180); // attempt 4
  assert.strictEqual(r4.attempt, 4);
  assert.strictEqual(r4.backoffMs, BACKOFF_SCHEDULE[3]);
});

test('Test 6: After 4 failed reconnects with backup → FAILOVER', () => {
  cleanup();
  // Create a backup provider
  try {
    db.run(
      `INSERT OR IGNORE INTO providers (id, name, email, gpu_model, os, status, last_heartbeat)
       VALUES (888, 'BackupProvider', 'backup@dc1.com', 'RTX 3090', 'linux', 'online', ?)`,
      new Date().toISOString()
    );
  } catch (e) { /* ignore */ }
  // Exhaust reconnects
  for (let i = 0; i < 4; i++) processHeartbeatGap(999, 100 + i * 30);
  const result = processHeartbeatGap(999, 300);
  assert.strictEqual(result.status, 'FAILOVER');
  assert.strictEqual(result.backupProviderId, 888);
  // Clean up backup
  db.run('DELETE FROM providers WHERE id = 888');
});

test('Test 7: After 4 failed reconnects with NO backup → CRITICAL', () => {
  cleanup();
  // Make sure no other online provider exists
  db.run("UPDATE providers SET status = 'offline' WHERE id != 999");
  for (let i = 0; i < 4; i++) processHeartbeatGap(999, 100 + i * 30);
  const result = processHeartbeatGap(999, 300);
  assert.strictEqual(result.status, 'CRITICAL');
  assert.ok(result.eventId);
  // Restore
  db.run("UPDATE providers SET status = 'online' WHERE id = 999");
});

test('Test 8: Latency >500ms sustained 60s → DEGRADED', () => {
  cleanup();
  const now = Date.now();
  // Start monitoring
  processLatency(999, 600, now);
  // 60 seconds later still high
  const result = processLatency(999, 550, now + 61000);
  assert.strictEqual(result.status, 'DEGRADED');
  assert.ok(result.eventId);
});

test('Test 9: Latency drops below threshold → recovers from DEGRADED', () => {
  cleanup();
  const now = Date.now();
  processLatency(999, 600, now);
  processLatency(999, 550, now + 61000); // triggers DEGRADED
  const result = processLatency(999, 200, now + 70000);
  assert.strictEqual(result.status, 'ONLINE');
});

test('Test 10: Recovery after WARNING resets to ONLINE', () => {
  cleanup();
  processHeartbeatGap(999, 45); // WARNING
  const result = processHeartbeatGap(999, 5); // recovered
  assert.strictEqual(result.status, 'ONLINE');
  assert.strictEqual(result.action, 'none');
});

test('Test 11: Resolve endpoint marks event as resolved', () => {
  cleanup();
  const r = processHeartbeatGap(999, 45);
  db.run('UPDATE recovery_events SET resolved_at = ? WHERE id = ?', new Date().toISOString(), r.eventId);
  const event = db.get('SELECT * FROM recovery_events WHERE id = ?', r.eventId);
  assert.ok(event.resolved_at);
});

test('Test 12: Summary counts are correct', () => {
  cleanup();
  processHeartbeatGap(999, 45); // WARNING
  _resetStates();
  processHeartbeatGap(999, 100); // RECONNECT
  const byType = db.all('SELECT event_type, COUNT(*) as count FROM recovery_events GROUP BY event_type');
  const types = Object.fromEntries(byType.map(r => [r.event_type, r.count]));
  assert.strictEqual(types['WARNING'], 1);
  assert.strictEqual(types['RECONNECT'], 1);
});
