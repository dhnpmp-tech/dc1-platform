'use strict';
const Database = require('better-sqlite3');
const request = require('supertest');
const express = require('express');

jest.mock('../db', () => {
  return {
    get get()     { return (sql, ...p) => global.__testDb.prepare(sql).get(...fp(p)); },
    get all()     { return (sql, ...p) => global.__testDb.prepare(sql).all(...fp(p)); },
    get run()     { return (sql, ...p) => global.__testDb.prepare(sql).run(...fp(p)); },
    get prepare() { return (sql) => global.__testDb.prepare(sql); },
    get _db()     { return global.__testDb; },
  };
  // eslint-disable-next-line no-unreachable
  function fp(p) { if (p.length===1&&Array.isArray(p[0])) return p[0]; return p.reduce((a,x)=>Array.isArray(x)?a.concat(x):a.concat([x]),[]); }
});
let mockIsAdmin = false;
jest.mock('../middleware/auth', () => ({
  getApiKeyFromReq: (req) => req.headers['x-renter-key'] || req.query.key || null,
  isAdminRequest: () => mockIsAdmin,
}));
const { jobsInvoiceRouter, rentersInvoiceRouter } = require('../routes/invoices');
function buildApp() { const a = express(); a.use(express.json()); a.use('/api/jobs', jobsInvoiceRouter); a.use('/api/renters', rentersInvoiceRouter); return a; }
function buildDb() {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE renters (id INTEGER PRIMARY KEY, name TEXT, email TEXT, organization TEXT, api_key TEXT, status TEXT DEFAULT 'active')");
  db.exec("CREATE TABLE providers (id INTEGER PRIMARY KEY, name TEXT, gpu_model TEXT)");
  db.exec("CREATE TABLE jobs (id INTEGER PRIMARY KEY, job_id TEXT UNIQUE NOT NULL, renter_id INTEGER, provider_id INTEGER, model TEXT, job_type TEXT DEFAULT 'llm-inference', status TEXT DEFAULT 'pending', cost_halala INTEGER DEFAULT 0, actual_cost_halala INTEGER, duration_minutes INTEGER, duration_seconds INTEGER, started_at TEXT, completed_at TEXT)");
  db.exec("CREATE TABLE job_settlements (id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, provider_id INTEGER, renter_id INTEGER NOT NULL, duration_seconds INTEGER, gpu_rate_per_second REAL, gross_amount_halala INTEGER NOT NULL, platform_fee_halala INTEGER NOT NULL, provider_payout_halala INTEGER NOT NULL, status TEXT DEFAULT 'completed', settled_at TEXT NOT NULL)");
  db.exec("CREATE TABLE serve_sessions (id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, provider_id INTEGER, model TEXT, total_tokens INTEGER DEFAULT 0, status TEXT DEFAULT 'stopped', started_at TEXT, expires_at TEXT, created_at TEXT)");
  db.exec("CREATE TABLE invoices (invoice_id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, renter_id INTEGER NOT NULL, provider_id INTEGER, amount_usd REAL NOT NULL, sar_equivalent REAL NOT NULL, settlement_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))");
  return db;
}
function seed(db, {renterId=1,provId=1,jobId='job-001',status='completed',costHalala=1000,grossHalala=1000,withSettlement=true}={}) {
  db.prepare('INSERT OR IGNORE INTO renters (id,name,email,api_key) VALUES (?,?,?,?)').run(renterId,'Alice','alice@dcp.sa','key-'+renterId);
  db.prepare('INSERT OR IGNORE INTO providers (id,name,gpu_model) VALUES (?,?,?)').run(provId,'ProvA','RTX 4090');
  db.prepare('INSERT OR IGNORE INTO jobs (job_id,renter_id,provider_id,model,status,cost_halala,duration_seconds,completed_at) VALUES (?,?,?,?,?,?,?,?)').run(jobId,renterId,provId,'llama3-8b',status,costHalala,300,'2026-03-24T01:05:00.000Z');
  if (withSettlement) { const fee=Math.round(grossHalala*0.15); db.prepare('INSERT OR IGNORE INTO job_settlements (id,job_id,provider_id,renter_id,duration_seconds,gross_amount_halala,platform_fee_halala,provider_payout_halala,settled_at) VALUES (?,?,?,?,?,?,?,?,?)').run('s-'+jobId,jobId,provId,renterId,300,grossHalala,fee,grossHalala-fee,'2026-03-24T01:05:01.000Z'); }
}
beforeEach(()=>{global.__testDb=buildDb();mockIsAdmin=false;});
afterEach(()=>{global.__testDb.close();});

describe('GET /api/jobs/:jobId/invoice', () => {
  test('returns invoice JSON for completed job', async () => {
    seed(global.__testDb); mockIsAdmin=true;
    const r = await request(buildApp()).get('/api/jobs/job-001/invoice');
    expect(r.status).toBe(200); expect(r.body.job_id).toBe('job-001'); expect(r.body.model).toBe('llama3-8b');
    expect(r.body.renter.email).toBe('alice@dcp.sa'); expect(r.body.settlement_hash).toHaveLength(64); expect(r.body.invoice_id).toBeTruthy();
  });
  test('SAR conversion: 375 halala = 1.0 USD at 3.75 peg', async () => {
    seed(global.__testDb,{costHalala:375,grossHalala:375}); mockIsAdmin=true;
    const r = await request(buildApp()).get('/api/jobs/job-001/invoice');
    expect(r.status).toBe(200); expect(r.body.total_usd).toBeCloseTo(1.0,4); expect(r.body.sar_equivalent).toBeCloseTo(3.75,4);
  });
  test('platform fee is exactly 15% of gross', async () => {
    seed(global.__testDb,{grossHalala:2000}); mockIsAdmin=true;
    const r = await request(buildApp()).get('/api/jobs/job-001/invoice');
    expect(r.status).toBe(200);
    expect(r.body.platform_fee_usd+r.body.subtotal_usd).toBeCloseTo(r.body.total_usd,6);
    expect(r.body.platform_fee_usd/r.body.total_usd).toBeCloseTo(0.15,4);
  });
  test('settlement_hash is deterministic', async () => {
    seed(global.__testDb); mockIsAdmin=true; const app=buildApp();
    const r1=await request(app).get('/api/jobs/job-001/invoice');
    const r2=await request(app).get('/api/jobs/job-001/invoice');
    expect(r1.body.settlement_hash).toBe(r2.body.settlement_hash);
  });
  test('409 for non-completed job', async () => {
    seed(global.__testDb,{status:'running',withSettlement:false}); mockIsAdmin=true;
    expect((await request(buildApp()).get('/api/jobs/job-001/invoice')).status).toBe(409);
  });
  test('404 for unknown job', async () => {
    mockIsAdmin=true; expect((await request(buildApp()).get('/api/jobs/no-such/invoice')).status).toBe(404);
  });
  test('403 when wrong renter accesses', async () => {
    const db=global.__testDb; seed(db,{renterId:1}); db.prepare('INSERT OR IGNORE INTO renters (id,name,email,api_key) VALUES (?,?,?,?)').run(2,'Bob','b@x.sa','key-2');
    mockIsAdmin=false; expect((await request(buildApp()).get('/api/jobs/job-001/invoice').set('x-renter-key','key-2')).status).toBe(403);
  });
  test('owning renter can access', async () => {
    seed(global.__testDb,{renterId:1}); mockIsAdmin=false;
    expect((await request(buildApp()).get('/api/jobs/job-001/invoice').set('x-renter-key','key-1')).status).toBe(200);
  });
  test('falls back to job cost without settlement', async () => {
    seed(global.__testDb,{costHalala:750,withSettlement:false}); mockIsAdmin=true;
    const r=await request(buildApp()).get('/api/jobs/job-001/invoice');
    expect(r.status).toBe(200); expect(r.body.total_usd).toBeCloseTo(750/100/3.75,4);
  });
});
describe('GET /api/renters/:renterId/invoices', () => {
  test('returns paginated list', async () => {
    const db=global.__testDb; seed(db);
    db.prepare('INSERT INTO invoices (invoice_id,job_id,renter_id,provider_id,amount_usd,sar_equivalent,settlement_hash) VALUES (?,?,?,?,?,?,?)').run('inv-1','job-001',1,1,0.266,0.999,'hash1');
    mockIsAdmin=true;
    const r=await request(buildApp()).get('/api/renters/1/invoices');
    expect(r.status).toBe(200); expect(r.body.invoices).toHaveLength(1); expect(r.body.pagination.total).toBe(1);
  });
  test('CSV export', async () => {
    const db=global.__testDb; seed(db);
    db.prepare('INSERT INTO invoices (invoice_id,job_id,renter_id,provider_id,amount_usd,sar_equivalent,settlement_hash) VALUES (?,?,?,?,?,?,?)').run('inv-1','job-001',1,1,0.266,0.999,'abc');
    mockIsAdmin=true;
    const r=await request(buildApp()).get('/api/renters/1/invoices?format=csv');
    expect(r.status).toBe(200); expect(r.headers['content-type']).toMatch(/text\/csv/);
    const l=r.text.trim().split('\r\n'); expect(l[0]).toContain('invoice_id'); expect(l[1]).toContain('inv-1');
  });
  test('403 for wrong renter', async () => {
    const db=global.__testDb;
    db.prepare('INSERT OR IGNORE INTO renters (id,name,email,api_key) VALUES (?,?,?,?)').run(1,'A','a@x.sa','key-a');
    db.prepare('INSERT OR IGNORE INTO renters (id,name,email,api_key) VALUES (?,?,?,?)').run(2,'B','b@x.sa','key-b');
    mockIsAdmin=false; expect((await request(buildApp()).get('/api/renters/1/invoices').set('x-renter-key','key-b')).status).toBe(403);
  });
  test('pagination slice', async () => {
    const db=global.__testDb; db.prepare('INSERT OR IGNORE INTO renters (id,name,email,api_key) VALUES (?,?,?,?)').run(1,'Alice','alice@dcp.sa','key-1');
    for(let i=1;i<=5;i++){db.prepare('INSERT INTO jobs (job_id,renter_id,status) VALUES (?,?,?)').run('jp'+i,1,'completed');db.prepare('INSERT INTO invoices (invoice_id,job_id,renter_id,amount_usd,sar_equivalent,settlement_hash) VALUES (?,?,?,?,?,?)').run('iv'+i,'jp'+i,1,0.1,0.375,'h'+i);}
    mockIsAdmin=true;
    const r=await request(buildApp()).get('/api/renters/1/invoices?page=2&limit=2');
    expect(r.status).toBe(200); expect(r.body.invoices).toHaveLength(2); expect(r.body.pagination.total).toBe(5); expect(r.body.pagination.pages).toBe(3);
  });
});
