/**
 * E2E Job Flow — full lifecycle: register → heartbeat → submit → complete → billing
 */
const request = require('supertest');
const { createApp } = require('./test-app');
const { cleanDb, registerProvider, bringOnline, db } = require('./helpers');

const app = createApp();

beforeEach(() => cleanDb());

describe('E2E Job Flow', () => {
  it('full lifecycle: register → heartbeat → submit → execute → complete → billing', async () => {
    // 1. Register provider
    const { apiKey, providerId } = await registerProvider(request, app);
    expect(providerId).toBeDefined();
    expect(apiKey).toBeDefined();

    // 2. Heartbeat → provider goes online
    const hbRes = await bringOnline(request, app, apiKey);
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.success).toBe(true);

    // Verify provider is online
    const provider = db.get('SELECT * FROM providers WHERE id = ?', providerId);
    expect(provider.status).toBe('online');

    // 3. Submit a job
    const jobRes = await request(app).post('/api/jobs/submit').send({
      provider_id: providerId,
      job_type: 'llm-inference',
      duration_minutes: 10,
    });
    expect(jobRes.status).toBe(201);
    expect(jobRes.body.success).toBe(true);

    const jobId = jobRes.body.job.id;
    expect(jobRes.body.job.provider_id).toBe(providerId);
    expect(jobRes.body.job.status).toBe('running'); // auto-transitions to running
    expect(jobRes.body.job.cost_halala).toBe(150); // 15 halala/min × 10 min

    // 4. Job is matched to provider (already assigned at submit)
    const activeRes = await request(app).get('/api/jobs/active');
    expect(activeRes.body.jobs.some(j => j.id === jobId)).toBe(true);

    // 5. Complete the job
    const completeRes = await request(app).post(`/api/jobs/${jobId}/complete`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.job.status).toBe('completed');

    // 6. Verify billing — provider credited (total_earnings in SAR = cost_halala / 100)
    const updatedProvider = db.get('SELECT * FROM providers WHERE id = ?', providerId);
    expect(updatedProvider.total_jobs).toBe(1);
    expect(updatedProvider.total_earnings).toBe(1.5); // 150 halala = 1.5 SAR

    // 7. Verify the completed job record
    const completedJob = db.get('SELECT * FROM jobs WHERE id = ?', jobId);
    expect(completedJob.status).toBe('completed');
    expect(completedJob.completed_at).toBeDefined();
    expect(completedJob.cost_halala).toBe(150);
  });

  it('rejects job submission to offline provider', async () => {
    const { providerId } = await registerProvider(request, app);
    // Don't send heartbeat — provider stays 'registered', not 'online'

    const res = await request(app).post('/api/jobs/submit').send({
      provider_id: providerId,
      job_type: 'training',
      duration_minutes: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not online/i);
  });

  it('rejects completing a non-running job', async () => {
    const { apiKey, providerId } = await registerProvider(request, app);
    await bringOnline(request, app, apiKey);

    const jobRes = await request(app).post('/api/jobs/submit').send({
      provider_id: providerId,
      job_type: 'rendering',
      duration_minutes: 5,
    });
    const jobId = jobRes.body.job.id;

    // Complete it
    await request(app).post(`/api/jobs/${jobId}/complete`);
    // Try completing again
    const res = await request(app).post(`/api/jobs/${jobId}/complete`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not running/i);
  });
});
