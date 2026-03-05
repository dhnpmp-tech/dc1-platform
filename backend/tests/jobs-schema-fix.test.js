const assert = require('assert');
const test = require('node:test');

const db = require('../src/db');
const { calculateCostHalala } = require('../src/routes/jobs');

function cleanup() {
  db.run('DELETE FROM jobs');
  db.run("DELETE FROM providers WHERE email = 'test-schema@dc1.test'");
}

function ensureProvider() {
  let p = db.get("SELECT * FROM providers WHERE email = 'test-schema@dc1.test'");
  if (!p) {
    db.run(
      `INSERT INTO providers (name, email, status, total_earnings, total_jobs)
       VALUES ('TestProvider', 'test-schema@dc1.test', 'online', 0, 0)`
    );
    p = db.get("SELECT * FROM providers WHERE email = 'test-schema@dc1.test'");
  }
  return p;
}

function insertJob(job_id, provider_id, job_type, status, duration) {
  const now = new Date().toISOString();
  const cost = calculateCostHalala(job_type, duration);
  db.run(
    `INSERT INTO jobs (job_id, provider_id, job_type, status, submitted_at, duration_minutes, cost_halala, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    job_id, provider_id, job_type, status, now, duration, cost, now
  );
  return { job_id, cost, now };
}

test('job submission inserts job_id', () => {
  cleanup();
  const provider = ensureProvider();
  const job_id = 'job-' + Date.now() + '-test1';
  insertJob(job_id, provider.id, 'llm-inference', 'pending', 10);

  const job = db.get('SELECT * FROM jobs WHERE job_id = ?', job_id);
  assert.ok(job, 'Job should exist');
  assert.strictEqual(job.job_id, job_id);
  assert.strictEqual(job.status, 'pending');
  assert.strictEqual(job.cost_halala, 150); // 15 * 10
  cleanup();
});

test('job_id is unique across submissions', () => {
  cleanup();
  const provider = ensureProvider();
  insertJob('job-uniq-1', provider.id, 'training', 'pending', 5);
  insertJob('job-uniq-2', provider.id, 'training', 'pending', 5);

  const jobs = db.all('SELECT job_id FROM jobs');
  assert.strictEqual(new Set(jobs.map(j => j.job_id)).size, 2);

  // Duplicate should throw
  assert.throws(() => {
    insertJob('job-uniq-1', provider.id, 'training', 'pending', 5);
  }, 'Duplicate job_id should throw');
  cleanup();
});

test('job complete flow end-to-end', () => {
  cleanup();
  const provider = ensureProvider();
  const { job_id, now } = insertJob('job-e2e', provider.id, 'rendering', 'pending', 20);

  db.run(`UPDATE jobs SET status = 'running', started_at = ? WHERE job_id = ?`, now, job_id);
  db.run(`UPDATE jobs SET status = 'completed', completed_at = ? WHERE job_id = ?`, now, job_id);

  const job = db.get('SELECT * FROM jobs WHERE job_id = ?', job_id);
  assert.strictEqual(job.status, 'completed');
  assert.ok(job.completed_at);
  assert.strictEqual(job.cost_halala, 400); // 20 * 20
  cleanup();
});

test('billing: provider earnings updated after complete', () => {
  cleanup();
  const provider = ensureProvider();
  const { job_id, cost, now } = insertJob('job-bill', provider.id, 'llm-inference', 'running', 10);

  db.run(`UPDATE jobs SET status = 'completed', completed_at = ? WHERE job_id = ?`, now, job_id);
  db.run(
    `UPDATE providers SET total_jobs = total_jobs + 1, total_earnings = total_earnings + ? WHERE id = ?`,
    cost / 100, provider.id
  );

  const updated = db.get('SELECT * FROM providers WHERE id = ?', provider.id);
  assert.strictEqual(updated.total_jobs, 1);
  assert.strictEqual(updated.total_earnings, cost / 100);
  cleanup();
});
