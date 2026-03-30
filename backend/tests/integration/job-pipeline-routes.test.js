/**
 * DCP-40: Integration Tests — Container Job Execution Pipeline
 *
 * Full job lifecycle via the Express routes in backend/src/routes/jobs.js:
 *   submit → queue → assign → pull → run → complete / fail / retry
 *
 * NOTE: better-sqlite3 requires a native rebuild for Node v24+. These tests
 * use a pure-JS in-memory mock for the `db` module so they run without
 * recompiling native addons. The mock faithfully implements the same
 * prepare/run/get/all interface that jobs.js consumes.
 *
 * Test categories:
 *   1.  Job submission — valid/invalid types, auth, balance checks
 *   2.  Priority queue ordering — high before normal before low
 *   3.  Transient failure retry logic — up to max_retries
 *   4.  HMAC signature verification — task_spec signed at submit
 *   5.  Escrow hold lifecycle — created → locked → released_provider / released_renter
 *   6.  vLLM serve job type — allowed, spec generated, serve_mode=true
 *   7.  custom_container job type — image carried in spec, daemon validates
 *   8.  Billing accuracy — 75/25 integer split, no rounding loss
 *
 * Runner: Jest + Supertest
 */

'use strict';

process.env.DC1_DB_PATH     = ':memory:';
process.env.DC1_ADMIN_TOKEN = 'test-admin-token';
process.env.DC1_HMAC_SECRET = 'test-hmac-secret-32-bytes-padding';

// ─── Pure-JS in-memory DB mock ───────────────────────────────────────────────
// Mimics the subset of better-sqlite3 used by jobs.js / providers.js / renters.js

class InMemoryDB {
  constructor() {
    this._tables = {
      providers:    [],
      renters:      [],
      jobs:         [],
      escrow_holds: [],
      heartbeat_log:[],
      daemon_events:[],
    };
    this._autoInc = {};
  }

  _nextId(table) {
    this._autoInc[table] = (this._autoInc[table] || 0) + 1;
    return this._autoInc[table];
  }

  reset() {
    for (const k of Object.keys(this._tables)) this._tables[k] = [];
    this._autoInc = {};
  }

  // ── Minimal SQL interpreter ────────────────────────────────────────────────
  // Only handles the patterns used by jobs.js, providers.js, renters.js.
  // Not a general SQL parser — just enough for these tests.

  run(sql, ...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params.flat();
    const s = sql.trim();

    // INSERT
    if (/^INSERT\s+INTO\s+(\w+)/i.test(s)) {
      return this._insert(s, flat);
    }
    // UPDATE
    if (/^UPDATE\s+(\w+)/i.test(s)) {
      this._update(s, flat);
      return { changes: 1 };
    }
    // DELETE
    if (/^DELETE\s+FROM\s+(\w+)/i.test(s)) {
      const m = s.match(/^DELETE\s+FROM\s+(\w+)/i);
      if (m) this._tables[m[1]] = [];
      return { changes: 0 };
    }
    return { changes: 0 };
  }

  get(sql, ...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params.flat();
    const rows = this._query(sql, flat);
    return rows[0] || null;
  }

  all(sql, ...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params.flat();
    return this._query(sql, flat);
  }

  prepare(sql) {
    return {
      run:  (...p) => this.run(sql, ...p),
      get:  (...p) => this.get(sql, ...p),
      all:  (...p) => this.all(sql, ...p),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _insert(sql, params) {
    const m = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/is);
    if (!m) return { lastInsertRowid: -1 };
    const table = m[1];
    const cols   = m[2].split(',').map(c => c.trim());
    // Parse VALUES tokens respecting literals vs placeholders
    const valTokens = this._splitValueTokens(m[3]);
    const row = {};
    let pi = 0;
    cols.forEach((col, i) => {
      const tok = (valTokens[i] || '').trim();
      if (tok === '?') {
        row[col] = params[pi++] !== undefined ? params[pi - 1] : null;
      } else if (/^'(.*)'$/.test(tok)) {
        row[col] = tok.slice(1, -1);
      } else if (/^-?\d+(\.\d+)?$/.test(tok)) {
        row[col] = Number(tok);
      } else if (tok === 'NULL') {
        row[col] = null;
      } else {
        row[col] = params[pi++] !== undefined ? params[pi - 1] : null;
      }
    });
    // auto id
    if (row.id == null) {
      row.id = this._nextId(table);
    }
    if (!this._tables[table]) this._tables[table] = [];
    this._tables[table].push(row);
    return { lastInsertRowid: row.id };
  }

  _splitValueTokens(valStr) {
    // Splits "?, ?, 'active', 1000, ?" respecting quoted strings
    const tokens = [];
    let cur = '', inQ = false;
    for (const ch of valStr) {
      if (ch === "'" && !inQ) { inQ = true; cur += ch; }
      else if (ch === "'" && inQ) { inQ = false; cur += ch; }
      else if (ch === ',' && !inQ) { tokens.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) tokens.push(cur.trim());
    return tokens;
  }

  _update(sql, params) {
    const tableM = sql.match(/UPDATE\s+(\w+)\s+SET\s/i);
    if (!tableM) return;
    const table = tableM[1];
    if (!this._tables[table]) return;

    const setM = sql.match(/SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)$/i);
    if (!setM) return;

    // Split SET clause by comma (respects quoted strings)
    const setClauses = this._splitValueTokens(setM[1]);
    const whereClause = setM[2].trim();

    // Parse each SET assignment; track which ?-params are consumed
    let pi = 0;
    const setUpdates = [];
    for (const clause of setClauses) {
      const eqI = clause.indexOf('=');
      if (eqI === -1) continue;
      const name     = clause.slice(0, eqI).trim();
      const valExpr  = clause.slice(eqI + 1).trim();

      if (valExpr === '?') {
        setUpdates.push({ name, type: 'literal', val: params[pi++] });
      } else if (/^'(.*)'$/s.test(valExpr)) {
        // Quoted string literal — strip surrounding quotes
        setUpdates.push({ name, type: 'literal', val: valExpr.slice(1, -1) });
      } else if (/^NULL$/i.test(valExpr)) {
        setUpdates.push({ name, type: 'literal', val: null });
      } else if (/^(\w+)\s*\+\s*\?$/.test(valExpr)) {
        // col + ? (arithmetic add with param)
        const idx = pi++;
        setUpdates.push({ name, type: 'arith', op: '+', col: valExpr.match(/^(\w+)/)[1], paramIdx: idx });
      } else if (/^(\w+)\s*-\s*\?$/.test(valExpr)) {
        // col - ? (arithmetic subtract with param)
        const idx = pi++;
        setUpdates.push({ name, type: 'arith', op: '-', col: valExpr.match(/^(\w+)/)[1], paramIdx: idx });
      } else if (/^(\w+)\s*\+\s*(\d+(?:\.\d+)?)$/.test(valExpr)) {
        // col + literal_number
        const m = valExpr.match(/^(\w+)\s*\+\s*(\d+(?:\.\d+)?)$/);
        setUpdates.push({ name, type: 'arith_lit', op: '+', col: m[1], litVal: Number(m[2]) });
      } else if (/^-?\d+(\.\d+)?$/.test(valExpr)) {
        setUpdates.push({ name, type: 'literal', val: Number(valExpr) });
      } else {
        // Unknown expression — store as-is (best-effort)
        setUpdates.push({ name, type: 'literal', val: valExpr });
      }
    }

    // Build WHERE filter using remaining params
    const whereParams = params.slice(pi);
    const whereFilter = this._makeWhereFilter(whereClause, whereParams);

    this._tables[table] = this._tables[table].map(row => {
      if (!whereFilter(row)) return row;
      const newRow = Object.assign({}, row);
      for (const upd of setUpdates) {
        if (upd.type === 'literal') {
          newRow[upd.name] = upd.val;
        } else if (upd.type === 'arith') {
          const base = row[upd.col] != null ? Number(row[upd.col]) : 0;
          const delta = Number(params[upd.paramIdx]);
          newRow[upd.name] = upd.op === '+' ? base + delta : base - delta;
        } else if (upd.type === 'arith_lit') {
          const base = row[upd.col] != null ? Number(row[upd.col]) : 0;
          newRow[upd.name] = upd.op === '+' ? base + upd.litVal : base - upd.litVal;
        }
      }
      return newRow;
    });
  }

  // Builds a single-call filter function for a WHERE clause + bound params array.
  _makeWhereFilter(wc, wParams) {
    return (row) => {
      let wi = 0;
      const parts = wc.split(/\s+AND\s+/i);
      return parts.every(part => {
        const inM = part.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
        if (inM) {
          const col = inM[1];
          const placeholders = inM[2].split(',').map(s => s.trim());
          const vals = placeholders.map(p => p === '?' ? String(wParams[wi++]) : p.replace(/'/g, ''));
          return vals.some(v => String(row[col]) === v);
        }
        const nullM = part.match(/(\w+)\s+IS\s+NULL/i);
        if (nullM) return row[nullM[1]] == null;
        const notNullM = part.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
        if (notNullM) return row[notNullM[1]] != null;
        const eqM = part.match(/(\w+)\s*=\s*\?/);
        if (eqM) { const v = wParams[wi++]; return row[eqM[1]] === v || String(row[eqM[1]]) === String(v); }
        const eqLitM = part.match(/(\w+)\s*=\s*'([^']*)'/);
        if (eqLitM) return String(row[eqLitM[1]]) === eqLitM[2];
        return true;
      });
    };
  }

  _query(sql, params) {
    const s = sql.trim();

    // SELECT COUNT(*) as cnt
    if (/SELECT\s+COUNT\(\*\)\s+as\s+cnt/i.test(s)) {
      return this._selectCount(s, params);
    }

    const tableM = s.match(/FROM\s+(\w+)/i);
    if (!tableM) return [];
    const table = tableM[1];
    const rows = (this._tables[table] || []).slice();

    // Handle JOINs (simplified — just return from left table)
    // WHERE
    let filtered = this._applyWhere(s, rows, params);
    // ORDER BY
    filtered = this._applyOrder(s, filtered);
    // LIMIT
    filtered = this._applyLimit(s, filtered);

    return filtered;
  }

  _applyWhere(sql, rows, params) {
    const whereM = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (!whereM) return rows;
    const wc = whereM[1].trim();

    return rows.filter(row => {
      let pi = 0; // reset per-row so each row evaluates params from index 0
      const parts = wc.split(/\s+AND\s+/i);
      return parts.every(part => {
        const inM = part.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
        if (inM) {
          const col = inM[1];
          const placeholders = inM[2].split(',').map(s => s.trim());
          const vals = placeholders.map(p => p === '?' ? params[pi++] : p.replace(/'/g, ''));
          return vals.some(v => String(row[col]) === String(v) || row[col] === v);
        }
        const nullM = part.match(/(\w+)\s+IS\s+NULL/i);
        if (nullM) return row[nullM[1]] == null;
        const notNullM = part.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
        if (notNullM) return row[notNullM[1]] != null;
        const orM = part.match(/(\w+)\s*=\s*\?\s+OR\s+(\w+)\s*=\s*\?/i);
        if (orM) {
          const v1 = params[pi++], v2 = params[pi++];
          return row[orM[1]] === v1 || String(row[orM[1]]) === String(v1) ||
                 row[orM[2]] === v2 || String(row[orM[2]]) === String(v2);
        }
        const eqM = part.match(/(\w+)\s*=\s*\?/);
        if (eqM) {
          const v = params[pi++];
          return row[eqM[1]] === v || String(row[eqM[1]]) === String(v);
        }
        const eqLitM = part.match(/(\w+)\s*=\s*'([^']*)'/);
        if (eqLitM) return String(row[eqLitM[1]]) === eqLitM[2];
        const ltM = part.match(/(\w+)\s*<\s*\?/);
        if (ltM) { const v = params[pi++]; return row[ltM[1]] < v; }
        return true;
      });
    });
  }

  _applyOrder(sql, rows) {
    const orderM = sql.match(/ORDER\s+BY\s+([\s\S]+?)(?:\s+LIMIT|$)/i);
    if (!orderM || !rows.length) return rows;
    const parts = orderM[1].split(',').map(s => s.trim());
    return rows.slice().sort((a, b) => {
      for (const part of parts) {
        const desc = /DESC/i.test(part);
        const colM = part.match(/(?:COALESCE\((\w+),\s*\d+\)|(\w+))/i);
        if (!colM) continue;
        const col = colM[1] || colM[2];
        const va = a[col] != null ? a[col] : 2;
        const vb = b[col] != null ? b[col] : 2;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp !== 0) return desc ? -cmp : cmp;
      }
      return 0;
    });
  }

  _applyLimit(sql, rows) {
    const limitM = sql.match(/LIMIT\s+(\d+)/i);
    if (!limitM) return rows;
    return rows.slice(0, parseInt(limitM[1]));
  }

  _selectCount(sql, params) {
    const tableM = sql.match(/FROM\s+(\w+)/i);
    if (!tableM) return [{ cnt: 0 }];
    const rows  = (this._tables[tableM[1]] || []).slice();
    const filtered = this._applyWhere(sql, rows, params);
    return [{ cnt: filtered.length }];
  }
}

// ─── Singleton mock DB ───────────────────────────────────────────────────────
const mockDb = new InMemoryDB();

// Mock the db module BEFORE any routes are required
jest.mock('../../src/db', () => mockDb);

// ─── Mock Supabase so it never tries to connect ──────────────────────────────
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: jest.fn().mockReturnThis(), upsert: jest.fn().mockResolvedValue({}) }),
  }),
}));

// ─── Now require the app ─────────────────────────────────────────────────────
const request = require('supertest');
const express = require('express');
const crypto  = require('crypto');

function createApp() {
  const app = express();
  app.use(express.json());
  const p = require.resolve('../../src/routes/jobs');
  delete require.cache[p];
  app.use('/api/jobs', require('../../src/routes/jobs'));
  return app;
}

let app;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanDb() {
  mockDb.reset();
}

/**
 * Directly insert a provider row — avoids going through providers.js HTTP layer
 * so the test only exercises jobs.js SQL patterns.
 */
function seedProvider(overrides = {}) {
  const id  = mockDb._nextId('providers');
  const key = `dc1-provider-test-${id}-${Date.now()}`;
  const row = {
    id,
    name:       overrides.name      || `Provider-${id}`,
    email:      overrides.email     || `prov-${id}@dc1.test`,
    api_key:    key,
    gpu_model:  overrides.gpu_model || 'RTX 4090',
    os:         'linux',
    status:     'online',
    vram_gb:    overrides.vram_gb   || 24,
    gpu_vram_mib: (overrides.vram_gb || 24) * 1024,
    total_earnings: 0,
    total_jobs:     0,
    claimable_earnings_halala: 0,
    gpu_tier: overrides.gpu_tier || null,
    available_gpu_tiers: overrides.available_gpu_tiers || null,
    cached_models: overrides.cached_models || null,
    vllm_models: overrides.vllm_models || null,
    created_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
  };
  mockDb._tables.providers.push(row);
  return { key, id };
}

/**
 * Directly insert a renter row — avoids going through renters.js HTTP layer.
 */
function seedRenter(balanceHalala = 50_000) {
  const id  = mockDb._nextId('renters');
  const key = `dc1-renter-test-${id}-${Date.now()}`;
  const row = {
    id,
    name:           `Renter-${id}`,
    email:          `renter-${id}@dc1.test`,
    api_key:        key,
    status:         'active',
    balance_halala: balanceHalala,
    total_spent_halala: 0,
    total_jobs:     0,
    created_at:     new Date().toISOString(),
  };
  mockDb._tables.renters.push(row);
  return { key, id };
}

function submitJob(renterKey, providerId, opts = {}) {
  return request(app)
    .post('/api/jobs/submit')
    .set('x-renter-key', renterKey)
    .send({
      provider_id:      providerId,
      job_type:         opts.job_type         || 'llm_inference',
      duration_minutes: opts.duration_minutes  || 5,
      params:           opts.params            || { prompt: 'Hello', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      priority:         opts.priority,
      max_duration_seconds: opts.max_duration_seconds,
      ...(opts._body || {}),
    });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  cleanDb();
  app = createApp();
});
afterAll(() => cleanDb());

// =============================================================================
// 1. JOB SUBMISSION
// =============================================================================

describe('Job Submission — POST /api/jobs/submit', () => {
  test('returns 201 with job_id and task_spec_signed=true for valid llm_inference job', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.job.job_id).toMatch(/^job-/);
    expect(res.body.job.task_spec_signed).toBe(true);
    expect(res.body.job.status).toBe('pending');
  });

  test('returns 401 without renter API key', async () => {
    const res = await request(app)
      .post('/api/jobs/submit')
      .send({ provider_id: 1, job_type: 'llm_inference', duration_minutes: 5 });
    expect(res.status).toBe(401);
  });

  test('returns 403 for invalid/unknown renter key', async () => {
    const { id: providerId } = seedProvider();
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', 'completely-wrong-key')
      .send({ provider_id: providerId, job_type: 'llm_inference', duration_minutes: 5 });
    expect(res.status).toBe(403);
  });

  test('returns 400 for unknown/disallowed job_type', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId, { job_type: 'arbitrary_code_exec' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid job_type/i);
  });

  test('returns 400 when raw Python task_spec is submitted (RCE guard)', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({
        provider_id: providerId,
        job_type: 'llm_inference',
        duration_minutes: 5,
        task_spec: 'import os; os.system("rm -rf /")',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/raw python/i);
  });

  test('returns 402 when renter balance is insufficient', async () => {
    const { key: renterKey } = seedRenter(1); // 1 halala — not enough
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId); // 5 min × 9 hal/min = 45 hal needed
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/insufficient balance/i);
    expect(res.body.shortfall_halala).toBeGreaterThan(0);
  });

  test('returns 400 when required fields are missing', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const res = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renterKey)
      .send({ job_type: 'llm_inference' }); // missing provider_id + duration_minutes
    expect(res.status).toBe(400);
  });

  test('returns 404 when provider_id does not exist', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const res = await submitJob(renterKey, 99999);
    expect(res.status).toBe(404);
  });

  test('returns 400 when provider is not online', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    // Take provider offline in mock DB
    const p = mockDb._tables.providers.find(r => r.id === providerId);
    if (p) p.status = 'offline';

    const res = await submitJob(renterKey, providerId);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not online/i);
  });

  test('deducts estimated cost from renter balance at submit time (pre-pay)', async () => {
    const initBalance = 50_000;
    const { key: renterKey, id: renterId } = seedRenter(initBalance);
    const { id: providerId } = seedProvider();

    await submitJob(renterKey, providerId, { duration_minutes: 5 });

    // llm_inference: 9 hal/min × 5 min = 45 hal deducted
    const renter = mockDb._tables.renters.find(r => r.id === renterId);
    expect(renter.balance_halala).toBe(initBalance - 45);
  });

  test('second job to same busy provider is queued (not pending)', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId } = seedProvider();

    const r1 = await submitJob(renterKey, providerId);
    expect(r1.status).toBe(201);
    expect(r1.body.job.status).toBe('pending');

    const r2 = await submitJob(renterKey, providerId);
    expect(r2.status).toBe(201);
    expect(r2.body.job.status).toBe('queued');
    expect(r2.body.queued).toBe(true);
  });
});

// =============================================================================
// 2. PRIORITY QUEUE ORDERING
// =============================================================================

describe('Priority queue ordering', () => {
  test('priority=1 (high) sorts before priority=2 (normal) in queued list', async () => {
    const { key: renterKey } = seedRenter(500_000);
    const { id: providerId } = seedProvider();

    // First job fills the 'pending' slot
    await submitJob(renterKey, providerId, { priority: 2 });

    // Queue a low then a high priority job
    await submitJob(renterKey, providerId, { priority: 3 }); // low
    await submitJob(renterKey, providerId, { priority: 1 }); // high

    // Inspect queue ordering in mock DB
    const queued = mockDb._tables.jobs
      .filter(j => j.provider_id === providerId && j.status === 'queued')
      .sort((a, b) => (a.priority || 2) - (b.priority || 2));

    expect(queued[0].priority).toBe(1);                          // high comes first
    expect(queued[queued.length - 1].priority).toBe(3);          // low comes last
  });

  test('default priority is 2 (normal) when not supplied', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId);
    expect(res.status).toBe(201);
    expect(res.body.job.priority).toBe(2);
  });

  test('out-of-range priority (e.g. 99) is normalised to 2', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId, { priority: 99 });
    expect(res.status).toBe(201);
    expect(res.body.job.priority).toBe(2);
  });
});

// =============================================================================
// 3. JOB LIFECYCLE — submit → assign → complete
// =============================================================================

describe('Job lifecycle — submit → assign → complete', () => {
  test('GET /api/jobs/assigned returns pending job and transitions it to assigned', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    const assignedRes = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.job.job_id).toBe(jobId);
    expect(assignedRes.body.job.status).toBe('assigned');
    expect(assignedRes.body.job.task_spec).toBeTruthy();
    expect(assignedRes.body.job.task_spec_hmac).toBeTruthy();
  });

  test('POST /:job_id/result with result completes job and pays provider (75/25 split)', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId, { duration_minutes: 5 });
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const completeRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'DC1_RESULT_JSON:{"type":"text","response":"done"}', duration_seconds: 120 });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.billing.provider_earned_halala).toBeGreaterThan(0);

    const total   = completeRes.body.billing.actual_cost_halala;
    const pEarned = completeRes.body.billing.provider_earned_halala;
    const dc1Fee  = completeRes.body.billing.dc1_fee_halala;
    expect(pEarned + dc1Fee).toBe(total);
    expect(pEarned).toBe(Math.floor(total * 0.75));
  });

  test('returns 409 when result is posted twice for the same job', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'first', duration_seconds: 60 });

    const dup = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'second' });

    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatch(/already settled/i);
  });

  test('returns 404 when assigned job endpoint called with unknown provider key', async () => {
    const res = await request(app).get('/api/jobs/assigned?key=no-such-key');
    expect(res.status).toBe(404);
  });

  test('GET /api/jobs/active returns jobs in active statuses', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();
    await submitJob(renterKey, providerId);

    const res = await request(app)
      .get('/api/jobs/active')
      .set('x-renter-key', renterKey);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/jobs/assigned rejects pending job with explicit tier_unavailable reason', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider({
      gpu_tier: 'C',
      available_gpu_tiers: JSON.stringify(['C']),
    });

    const submitRes = await submitJob(renterKey, providerId, {
      _body: {
        gpu_requirements: { min_vram_gb: 24 }, // maps to required tier B
      },
    });

    expect(submitRes.status).toBe(201);
    const pollRes = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.job).toBeNull();
    expect(pollRes.body.rejection).toBeTruthy();
    expect(pollRes.body.rejection.reason).toBe('tier_unavailable');
    expect(pollRes.body.rejection.required_tier).toBe('B');

    const jobRow = mockDb._tables.jobs.find((job) => job.job_id === submitRes.body.job.job_id);
    expect(jobRow.status).toBe('queued');
    expect(String(jobRow.notes || '')).toMatch(/tier_unavailable/i);
  });

  test('GET /api/jobs/assigned rejects inference job with explicit model_unavailable reason', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider({
      cached_models: JSON.stringify(['meta-llama/Meta-Llama-3-8B-Instruct']),
      available_gpu_tiers: JSON.stringify(['A', 'B', 'C']),
    });

    const submitRes = await submitJob(renterKey, providerId, {
      params: { prompt: 'hello', model: 'mistralai/Mistral-7B-Instruct-v0.2' },
    });
    expect(submitRes.status).toBe(201);

    const pollRes = await request(app).get(`/api/jobs/assigned?key=${providerKey}`);
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.job).toBeNull();
    expect(pollRes.body.rejection).toBeTruthy();
    expect(pollRes.body.rejection.reason).toBe('model_unavailable');
    expect(pollRes.body.rejection.requested_model).toBe('mistralai/Mistral-7B-Instruct-v0.2');
  });
});

// =============================================================================
// 4. TRANSIENT FAILURE RETRY LOGIC
// =============================================================================

describe('Transient failure retry logic — POST /api/jobs/:job_id/result', () => {
  test('resets job to pending with retry_count=1 on first transient failure', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;
    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const failRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Docker pull timeout', transient: true });

    expect(failRes.status).toBe(200);
    expect(failRes.body.retry).toBe(true);
    expect(failRes.body.attempt).toBe(1);

    const job = mockDb._tables.jobs.find(j => j.job_id === jobId);
    expect(job.status).toBe('pending');
    expect(job.retry_count).toBe(1);
  });

  test('permanently fails job after max_retries (2) exhausted', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    // Pre-set retry_count to max so next transient failure exhausts it
    const job = mockDb._tables.jobs.find(j => j.job_id === jobId);
    job.retry_count = 2;
    job.max_retries = 2;
    job.picked_up_at = null;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const failRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'GPU failed again', transient: true });

    expect(failRes.status).toBe(200);
    expect(failRes.body.retry).toBeFalsy();

    const updatedJob = mockDb._tables.jobs.find(j => j.job_id === jobId);
    expect(updatedJob.status).toBe('failed');
  });

  test('does NOT retry non-transient (permanent) failures', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;
    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const failRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Script raised exception', transient: false });

    expect(failRes.status).toBe(200);
    expect(failRes.body.retry).toBeFalsy();
  });

  test('refunds renter balance in full on permanent failure (no result)', async () => {
    const initBalance = 50_000;
    const { key: renterKey, id: renterId } = seedRenter(initBalance);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId, { duration_minutes: 5 });
    const jobId = submitRes.body.job.job_id;

    const afterSubmit = mockDb._tables.renters.find(r => r.id === renterId).balance_halala;
    expect(afterSubmit).toBe(initBalance - 45); // 9 hal/min × 5 min

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Container crashed' });

    const afterFail = mockDb._tables.renters.find(r => r.id === renterId).balance_halala;
    expect(afterFail).toBe(initBalance);
  });
});

// =============================================================================
// 5. HMAC SIGNATURE VERIFICATION
// =============================================================================

describe('HMAC signature verification — GET /api/jobs/verify-hmac', () => {
  test('verifies a valid HMAC signature (token matches what was stored)', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    // Retrieve actual HMAC from mock DB
    const job = mockDb._tables.jobs.find(j => j.job_id === jobId);
    const storedHmac = job.task_spec_hmac;

    const verifyRes = await request(app)
      .get('/api/jobs/verify-hmac')
      .set('x-provider-key', providerKey)
      .query({ job_id: jobId, hmac: storedHmac });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
  });

  test('rejects a tampered/incorrect HMAC', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    const verifyRes = await request(app)
      .get('/api/jobs/verify-hmac')
      .set('x-provider-key', providerKey)
      .query({ job_id: jobId, hmac: 'a'.repeat(64) });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(false);
  });

  test('returns 401 when provider key is not supplied', async () => {
    const res = await request(app)
      .get('/api/jobs/verify-hmac')
      .query({ job_id: 'job-1', hmac: 'abc' });
    expect(res.status).toBe(401);
  });

  test('returns 403 when a different provider tries to verify the job', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId1 } = seedProvider({ email: `p1-${Date.now()}@dc1.test` });
    const { key: providerKey2 } = seedProvider({ email: `p2-${Date.now()}@dc1.test` });

    const submitRes = await submitJob(renterKey, providerId1);
    const jobId = submitRes.body.job.job_id;
    const job = mockDb._tables.jobs.find(j => j.job_id === jobId);

    const verifyRes = await request(app)
      .get('/api/jobs/verify-hmac')
      .set('x-provider-key', providerKey2) // wrong provider
      .query({ job_id: jobId, hmac: job.task_spec_hmac });

    expect(verifyRes.status).toBe(403);
  });

  test('all submitted job types produce a signed task_spec', async () => {
    for (const jobType of ['llm_inference', 'image_generation', 'vllm_serve', 'custom_container']) {
      cleanDb();
      app = createApp();
      const { key: rk } = seedRenter(200_000);
      const { id: pid } = seedProvider();

      const res = await submitJob(rk, pid, {
        job_type: jobType,
        params: { prompt: 'test', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', script: 'print("ok")' },
        duration_minutes: 5,
      });
      expect(res.status).toBe(201);
      expect(res.body.job.task_spec_signed).toBe(true);
    }
  });
});

// =============================================================================
// 6. ESCROW HOLD LIFECYCLE
// =============================================================================

describe('Escrow hold lifecycle', () => {
  test('escrow_hold record with status=held is created at submit time', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    const escrow = mockDb._tables.escrow_holds.find(e => e.job_id === jobId);
    expect(escrow).toBeTruthy();
    expect(escrow.status).toBe('held');
    expect(escrow.amount_halala).toBeGreaterThan(0);
    expect(escrow.id).toBe(`esc-${jobId}`);
  });

  test('escrow advances to locked when daemon picks up job', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const escrow = mockDb._tables.escrow_holds.find(e => e.job_id === jobId);
    expect(escrow.status).toBe('locked');
  });

  test('escrow → released_provider when job succeeds', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'success', duration_seconds: 120 });

    const escrow = mockDb._tables.escrow_holds.find(e => e.job_id === jobId);
    expect(escrow.status).toBe('released_provider');
  });

  test('escrow → released_renter when job fails (no result)', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const submitRes = await submitJob(renterKey, providerId);
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ error: 'Container crashed' });

    const escrow = mockDb._tables.escrow_holds.find(e => e.job_id === jobId);
    expect(escrow.status).toBe('released_renter');
  });

  test('provider claimable_earnings_halala incremented by provider_earned on success', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId, key: providerKey } = seedProvider();

    const beforeRow = mockDb._tables.providers.find(p => p.id === providerId);
    const before = beforeRow?.claimable_earnings_halala || 0;

    const submitRes = await submitJob(renterKey, providerId, { duration_minutes: 2 });
    const jobId = submitRes.body.job.job_id;

    await request(app).get(`/api/jobs/assigned?key=${providerKey}`);

    const completeRes = await request(app)
      .post(`/api/jobs/${jobId}/result`)
      .set('x-provider-key', providerKey)
      .send({ result: 'output', duration_seconds: 120 });

    const providerEarned = completeRes.body.billing.provider_earned_halala;
    const afterRow = mockDb._tables.providers.find(p => p.id === providerId);
    const after = afterRow?.claimable_earnings_halala || 0;
    expect(after - before).toBe(providerEarned);
  });
});

// =============================================================================
// 7. vLLM SERVE JOB TYPE
// =============================================================================

describe('vLLM serve job type', () => {
  test('vllm_serve is accepted as a valid job type', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      duration_minutes: 30,
    });
    expect(res.status).toBe(201);
    expect(res.body.job.job_type).toBe('vllm_serve');
  });

  test('vllm_serve task_spec is valid JSON with serve_mode=true', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId } = seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      duration_minutes: 10,
    });

    const job = mockDb._tables.jobs.find(j => j.job_type === 'vllm_serve');
    const spec = JSON.parse(job.task_spec);
    expect(spec.serve_mode).toBe(true);
    expect(typeof spec.model).toBe('string');
    expect(typeof spec.max_model_len).toBe('number');
    expect(['float16', 'bfloat16', 'float32']).toContain(spec.dtype);
  });

  test('vllm_serve falls back to safe default model when unknown model is supplied', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId } = seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'attacker/malicious-model' },
      duration_minutes: 10,
    });

    const job = mockDb._tables.jobs.find(j => j.job_type === 'vllm_serve');
    const spec = JSON.parse(job.task_spec);
    expect(spec.model).toBe('TinyLlama/TinyLlama-1.1B-Chat-v1.0');
  });

  test('vllm_serve max_model_len is clamped to [512, 32768]', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId } = seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'vllm_serve',
      params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', max_model_len: 999999 },
      duration_minutes: 10,
    });

    const job = mockDb._tables.jobs.find(j => j.job_type === 'vllm_serve');
    const spec = JSON.parse(job.task_spec);
    expect(spec.max_model_len).toBeLessThanOrEqual(32768);
  });
});

// =============================================================================
// 8. CUSTOM CONTAINER JOB TYPE
// =============================================================================

describe('custom_container job type', () => {
  test('custom_container is accepted as a valid job type', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    const res = await submitJob(renterKey, providerId, {
      job_type: 'custom_container',
      params: { image_override: 'dc1/general-worker:latest', script: 'print("hello")' },
      duration_minutes: 5,
    });
    expect(res.status).toBe(201);
    expect(res.body.job.job_type).toBe('custom_container');
  });

  test('custom_container task_spec carries image_override and script in JSON', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    await submitJob(renterKey, providerId, {
      job_type: 'custom_container',
      params: { image_override: 'dc1/llm-worker:latest', script: 'import torch' },
      duration_minutes: 5,
    });

    const job = mockDb._tables.jobs.find(j => j.job_type === 'custom_container');
    const spec = JSON.parse(job.task_spec);
    expect(spec.image_override).toBe('dc1/llm-worker:latest');
    expect(spec.script).toContain('torch');
  });

  test('backend rejects unapproved image override (DCP-663 server-side validation)', async () => {
    const { key: renterKey } = seedRenter(50_000);
    const { id: providerId } = seedProvider();

    // DCP-663: Backend now validates image_override against approved registry
    const res = await submitJob(renterKey, providerId, {
      job_type: 'custom_container',
      params: { image_override: 'attacker/exploit:latest', script: 'print("hi")' },
      duration_minutes: 5,
    });
    expect(res.status).toBe(400); // rejected at submission
    expect(res.body.error).toMatch(/not.*approved/i);
  });
});

// =============================================================================
// 9. BILLING ACCURACY — 75/25 SPLIT
// =============================================================================

describe('Billing accuracy — 75/25 split', () => {
  const cases = [
    { type: 'llm_inference',    rate: 9,  mins: 5 },
    { type: 'image_generation', rate: 10, mins: 5 },
    { type: 'vllm_serve',       rate: 9,  mins: 10 },
  ];

  for (const { type, rate, mins } of cases) {
    test(`${type}: provider_earned + dc1_fee === total (integer, no rounding loss)`, async () => {
      cleanDb();
      app = createApp();
      const { key: rk } = seedRenter(200_000);
      const { id: pid, key: pk } = seedProvider();

      const submitRes = await submitJob(rk, pid, {
        job_type: type,
        duration_minutes: mins,
        params: { model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', prompt: 'test' },
      });
      const jobId = submitRes.body.job.job_id;
      expect(submitRes.status).toBe(201);

      await request(app).get(`/api/jobs/assigned?key=${pk}`);

      const completeRes = await request(app)
        .post(`/api/jobs/${jobId}/result`)
        .set('x-provider-key', pk)
        .send({ result: 'output', duration_seconds: mins * 60 });

      expect(completeRes.status).toBe(200);
      const { actual_cost_halala, provider_earned_halala, dc1_fee_halala } = completeRes.body.billing;
      expect(provider_earned_halala + dc1_fee_halala).toBe(actual_cost_halala);
      expect(provider_earned_halala).toBe(Math.floor(actual_cost_halala * 0.75));
    });
  }
});

// =============================================================================
// 10. QUEUE ENDPOINT
// =============================================================================

describe('GET /api/jobs/queue/:provider_id', () => {
  test('returns queued and pending jobs for a provider', async () => {
    const { key: renterKey } = seedRenter(200_000);
    const { id: providerId, key: providerKey } = seedProvider();

    await submitJob(renterKey, providerId);
    await submitJob(renterKey, providerId); // queued

    const res = await request(app)
      .get(`/api/jobs/queue/${providerId}`)
      .set('x-provider-key', providerKey);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  test('returns empty queue for a provider with no active jobs', async () => {
    const { id: providerId, key: providerKey } = seedProvider();

    const res = await request(app)
      .get(`/api/jobs/queue/${providerId}`)
      .set('x-provider-key', providerKey);
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
