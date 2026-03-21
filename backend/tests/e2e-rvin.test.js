const express = require('express');
const http = require('http');
const path = require('path');

// Override DB path to use temp test database
const fs = require('fs');
const TEST_DB_DIR = path.join(__dirname, '..', 'data-test');
if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
process.env.DC1_TEST_DB = path.join(TEST_DB_DIR, 'test-' + Date.now() + '.db');

// We need a fresh DB for each test run — patch db.js path
const Database = require('better-sqlite3');
let testDb;
let server;
let baseUrl;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Simple test runner
let passed = 0, failed = 0, tests = [];
function test(name, fn) { tests.push({ name, fn }); }

async function setup() {
  // Create fresh test database
  const dbPath = process.env.DC1_TEST_DB;
  testDb = new Database(dbPath);
  testDb.pragma('journal_mode = WAL');

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      organization TEXT, gpu_model TEXT, gpu_count INTEGER DEFAULT 1, vram_gb INTEGER,
      os TEXT DEFAULT 'linux', bandwidth_mbps INTEGER, storage_tb REAL, location TEXT,
      ip_address TEXT, status TEXT DEFAULT 'pending', api_key TEXT, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      gpu_status TEXT, provider_ip TEXT, provider_hostname TEXT, last_heartbeat TEXT,
      gpu_name_detected TEXT, gpu_vram_mib INTEGER DEFAULT 0, gpu_driver TEXT, gpu_compute TEXT,
      total_earnings REAL DEFAULT 0, total_jobs INTEGER DEFAULT 0, uptime_percent REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL, job_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending', submitted_at DATETIME, started_at DATETIME, completed_at DATETIME,
      duration_minutes INTEGER, cost_halala INTEGER DEFAULT 0, gpu_requirements TEXT, notes TEXT,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );
  `);

  // Seed providers
  testDb.exec(`
    INSERT INTO providers (name, email, gpu_model, vram_gb, status, api_key)
    VALUES ('RTX3090-Node', 'rtx3090@dc1.test', 'RTX 3090', 24, 'online', 'test-key-3090');
  `);
  testDb.exec(`
    INSERT INTO providers (name, email, gpu_model, vram_gb, status, api_key)
    VALUES ('RTX4060-Node', 'rtx4060@dc1.test', 'RTX 4060', 8, 'online', 'test-key-4060');
  `);
  testDb.exec(`
    INSERT INTO providers (name, email, gpu_model, vram_gb, status, api_key)
    VALUES ('Offline-Node', 'offline@dc1.test', 'RTX 3080', 10, 'offline', 'test-key-off');
  `);

  // Build express app with test db
  const app = express();
  app.use(express.json());

  // Monkey-patch db module to use test db
  const dbModule = require('../src/db');
  const origRun = dbModule.run;
  const origGet = dbModule.get;
  const origAll = dbModule.all;

  function flatP(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((a, p) => Array.isArray(p) ? a.concat(p) : a.concat([p]), []);
  }
  dbModule.run = (sql, ...params) => testDb.prepare(sql).run(...flatP(params));
  dbModule.get = (sql, ...params) => testDb.prepare(sql).get(...flatP(params));
  dbModule.all = (sql, ...params) => testDb.prepare(sql).all(...flatP(params));

  const jobsRouter = require('../src/routes/jobs');
  app.use('/api/jobs', jobsRouter);

  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function teardown() {
  if (server) server.close();
  if (testDb) testDb.close();
  const dbPath = process.env.DC1_TEST_DB;
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

// ==================== TESTS ====================

test('1. Submit job - success', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'llm-inference', duration_minutes: 30
  });
  if (r.status !== 201) throw new Error(`Expected 201, got ${r.status}`);
  if (!r.body.success) throw new Error('Expected success');
  if (r.body.job.status !== 'running') throw new Error('Expected running status');
});

test('2. Submit job - missing fields', async () => {
  const r = await request('POST', '/api/jobs/submit', { provider_id: 1 });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('3. Submit job - invalid duration', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'training', duration_minutes: -5
  });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('4. Submit job - provider not found', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 999, job_type: 'training', duration_minutes: 10
  });
  if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
});

test('5. Submit job - offline provider', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 3, job_type: 'training', duration_minutes: 10
  });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
  if (!r.body.error.includes('not online')) throw new Error('Expected not online error');
});

test('6. Get job status', async () => {
  const sub = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'rendering', duration_minutes: 15
  });
  const r = await request('GET', `/api/jobs/${sub.body.job.id}`);
  if (r.status !== 200) throw new Error(`Expected 200`);
  if (r.body.job.id !== sub.body.job.id) throw new Error('Job ID mismatch');
});

test('7. Get job - not found', async () => {
  const r = await request('GET', '/api/jobs/9999');
  if (r.status !== 404) throw new Error(`Expected 404`);
});

test('8. List active jobs', async () => {
  const r = await request('GET', '/api/jobs/active');
  if (r.status !== 200) throw new Error(`Expected 200`);
  if (!Array.isArray(r.body.jobs)) throw new Error('Expected jobs array');
  if (r.body.jobs.length < 1) throw new Error('Expected at least 1 active job');
});

test('9. Complete a job', async () => {
  const sub = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'training', duration_minutes: 20
  });
  const r = await request('POST', `/api/jobs/${sub.body.job.id}/complete`);
  if (r.status !== 200) throw new Error(`Expected 200`);
  if (r.body.job.status !== 'completed') throw new Error('Expected completed');
  if (!r.body.job.completed_at) throw new Error('Expected completed_at');
});

test('10. Complete non-running job fails', async () => {
  const sub = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'training', duration_minutes: 5
  });
  await request('POST', `/api/jobs/${sub.body.job.id}/complete`);
  const r = await request('POST', `/api/jobs/${sub.body.job.id}/complete`);
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('11. Cancel a running job', async () => {
  const sub = await request('POST', '/api/jobs/submit', {
    provider_id: 2, job_type: 'rendering', duration_minutes: 10
  });
  const r = await request('POST', `/api/jobs/${sub.body.job.id}/cancel`);
  if (r.status !== 200) throw new Error(`Expected 200`);
  if (r.body.job.status !== 'cancelled') throw new Error('Expected cancelled');
});

test('12. Cancel already completed job fails', async () => {
  const sub = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'training', duration_minutes: 5
  });
  await request('POST', `/api/jobs/${sub.body.job.id}/complete`);
  const r = await request('POST', `/api/jobs/${sub.body.job.id}/cancel`);
  if (r.status !== 400) throw new Error(`Expected 400`);
});

test('13. Cost calculation - llm-inference 60 min = 900 halala', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'llm-inference', duration_minutes: 60
  });
  if (r.body.job.cost_halala !== 900) throw new Error(`Expected 900, got ${r.body.job.cost_halala}`);
});

test('14. Cost calculation - training 100 min = 2500 halala', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'training', duration_minutes: 100
  });
  if (r.body.job.cost_halala !== 2500) throw new Error(`Expected 2500, got ${r.body.job.cost_halala}`);
});

test('15. Cost is always integer (no floats)', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'llm-inference', duration_minutes: 7
  });
  if (!Number.isInteger(r.body.job.cost_halala)) throw new Error('Cost must be integer');
  if (r.body.job.cost_halala !== 105) throw new Error(`Expected 105, got ${r.body.job.cost_halala}`);
});

test('16. GPU requirements - insufficient VRAM rejected', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 2, job_type: 'llm-inference', duration_minutes: 30,
    gpu_requirements: { min_vram_gb: 16 }
  });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
  if (!r.body.error.includes('GPU requirements')) throw new Error('Expected GPU requirements error');
});

test('17. GPU requirements - sufficient VRAM accepted', async () => {
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'llm-inference', duration_minutes: 30,
    gpu_requirements: { min_vram_gb: 20 }
  });
  if (r.status !== 201) throw new Error(`Expected 201, got ${r.status}`);
});

test('18. Full lifecycle: submit → running → complete', async () => {
  const sub = await request('POST', '/api/jobs/submit', {
    provider_id: 1, job_type: 'training', duration_minutes: 45
  });
  if (sub.body.job.status !== 'running') throw new Error('Expected running');

  const comp = await request('POST', `/api/jobs/${sub.body.job.id}/complete`);
  if (comp.body.job.status !== 'completed') throw new Error('Expected completed');

  const get = await request('GET', `/api/jobs/${sub.body.job.id}`);
  if (get.body.job.status !== 'completed') throw new Error('Expected completed on get');
});

test('19. Mock RVIN: 60-min LLM inference on RTX 3090', async () => {
  // Submit RVIN job targeting RTX 3090 provider (id=1, 24GB VRAM)
  const r = await request('POST', '/api/jobs/submit', {
    provider_id: 1,
    job_type: 'llm-inference',
    duration_minutes: 60,
    gpu_requirements: { min_vram_gb: 20, gpu_model: 'RTX 3090' }
  });
  if (r.status !== 201) throw new Error(`Expected 201, got ${r.status}`);
  if (r.body.job.provider_id !== 1) throw new Error('Expected provider 1 (RTX 3090)');
  if (r.body.job.cost_halala !== 900) throw new Error(`Cost should be 900 halala (9 SAR)`);
  if (r.body.job.status !== 'running') throw new Error('Expected running');

  // Complete the RVIN job
  const comp = await request('POST', `/api/jobs/${r.body.job.id}/complete`);
  if (comp.body.job.status !== 'completed') throw new Error('Expected completed');
});

test('20. Cancel non-existent job returns 404', async () => {
  const r = await request('POST', '/api/jobs/8888/cancel');
  if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
});

// ==================== RUN ====================
(async () => {
  try {
    await setup();
    for (const t of tests) {
      try {
        await t.fn();
        passed++;
        console.log(`  ✅ ${t.name}`);
      } catch (e) {
        failed++;
        console.log(`  ❌ ${t.name}: ${e.message}`);
      }
    }
    console.log(`\n${passed}/${tests.length} passed, ${failed} failed`);
    await teardown();
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('Setup error:', e);
    process.exit(1);
  }
})();
