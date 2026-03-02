/**
 * E2E Failover — provider disconnect detection + job migration
 */
const request = require('supertest');
const { createApp } = require('./test-app');
const { cleanDb, registerProvider, bringOnline, db } = require('./helpers');
const { runRecoveryCycle } = require('../../src/services/recovery-engine');

const app = createApp();

beforeEach(() => cleanDb());

describe('E2E Failover', () => {
  it('migrates job from disconnected provider to backup', async () => {
    // 1. Register 2 providers
    const provA = await registerProvider(request, app, { name: 'Provider A', email: 'a@dc1.test' });
    const provB = await registerProvider(request, app, { name: 'Provider B', email: 'b@dc1.test' });

    await bringOnline(request, app, provA.apiKey);
    await bringOnline(request, app, provB.apiKey);

    // Set VRAM so backup selection works
    db.run('UPDATE providers SET gpu_vram_mib = 24000 WHERE id = ?', provA.providerId);
    db.run('UPDATE providers SET gpu_vram_mib = 24000 WHERE id = ?', provB.providerId);

    // 2. Submit a job → matched to Provider A
    const jobRes = await request(app).post('/api/jobs/submit').send({
      provider_id: provA.providerId,
      job_type: 'llm-inference',
      duration_minutes: 60,
    });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.job.id;

    // The jobs table has both `id` (int) and `job_id` (text). Recovery engine uses job_id.
    // We need to set job_id for the recovery engine to work.
    const job = db.get('SELECT * FROM jobs WHERE id = ?', jobId);
    const jobIdText = job.job_id || String(jobId);
    if (!job.job_id) {
      db.run('UPDATE jobs SET job_id = ? WHERE id = ?', String(jobId), jobId);
    }

    // 3. Simulate Provider A disconnect — set last_heartbeat to 2 minutes ago
    const oldTime = new Date(Date.now() - 120 * 1000).toISOString();
    db.run('UPDATE providers SET last_heartbeat = ? WHERE id = ?', oldTime, provA.providerId);

    // 4. Run recovery cycle
    runRecoveryCycle();

    // 5. Verify Provider A marked as disconnected
    const provAUpdated = db.get('SELECT * FROM providers WHERE id = ?', provA.providerId);
    expect(provAUpdated.status).toBe('disconnected');

    // 6. Verify recovery_event created
    const events = db.all('SELECT * FROM recovery_events WHERE from_provider_id = ?', provA.providerId);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const event = events[0];
    expect(event.to_provider_id).toBe(provB.providerId);
    expect(event.status).toBe('success');
    expect(event.reason).toBe('provider_disconnect');

    // 7. Verify job migrated to Provider B
    const migratedJob = db.get('SELECT * FROM jobs WHERE id = ?', jobId);
    // Recovery engine updates by job_id text field
    expect(migratedJob.provider_id).toBe(provB.providerId);
  });

  it('records no_backup when no other provider available', async () => {
    const provA = await registerProvider(request, app, { name: 'Solo Provider', email: 'solo@dc1.test' });
    await bringOnline(request, app, provA.apiKey);

    const jobRes = await request(app).post('/api/jobs/submit').send({
      provider_id: provA.providerId,
      job_type: 'training',
      duration_minutes: 30,
    });
    const jobId = jobRes.body.job.id;
    const job = db.get('SELECT * FROM jobs WHERE id = ?', jobId);
    if (!job.job_id) {
      db.run('UPDATE jobs SET job_id = ? WHERE id = ?', String(jobId), jobId);
    }

    // Disconnect provider A
    const oldTime = new Date(Date.now() - 120 * 1000).toISOString();
    db.run('UPDATE providers SET last_heartbeat = ? WHERE id = ?', oldTime, provA.providerId);

    runRecoveryCycle();

    const events = db.all('SELECT * FROM recovery_events WHERE from_provider_id = ?', provA.providerId);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].status).toBe('no_backup');
  });
});
