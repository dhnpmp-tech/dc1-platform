const request = require('supertest');
const { createApp } = require('./integration/test-app');
const { cleanDb, registerProvider, db } = require('./integration/helpers');

const app = createApp();

describe('Provider self-service endpoints', () => {
  let providerKey;
  let providerId;

  beforeEach(async () => {
    cleanDb();
    const registration = await registerProvider(request, app, {
      name: 'Provider Me Test',
      gpu_model: 'RTX 4090',
      os: 'Windows',
    });

    providerKey = registration.apiKey;
    providerId = registration.providerId;

    db.run(
      `UPDATE providers
       SET status = ?, gpu_vram_mib = ?, run_mode = ?, is_paused = 0
       WHERE id = ?`,
      'online',
      8192,
      'always-on',
      providerId
    );
  });

  test('GET /api/providers/me returns provider data', async () => {
    const res = await request(app).get(`/api/providers/me?key=${providerKey}`);

    expect(res.status).toBe(200);
    expect(res.body.provider).toBeDefined();
    expect(res.body.provider.id).toBe(providerId);
    expect(res.body.provider.name).toBe('Provider Me Test');
    expect(res.body.provider.gpu_model).toBe('RTX 4090');
    expect(res.body.provider.run_mode).toBe('always-on');
    expect(res.body.provider.is_paused).toBe(false);
    expect(res.body.provider.gpu_metrics).toBeDefined();
    expect(res.body.provider.active_job).toBeNull();
    expect(res.body.provider.gpu_vram_mib).toBe(8192);
  });

  test('GET /api/providers/me returns 404 for invalid key', async () => {
    const res = await request(app).get('/api/providers/me?key=invalid-key');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Provider not found');
  });

  test('POST /api/providers/pause pauses provider', async () => {
    const pauseRes = await request(app)
      .post('/api/providers/pause')
      .send({ key: providerKey });

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.success).toBe(true);
    expect(pauseRes.body.status).toBe('paused');

    const meRes = await request(app).get(`/api/providers/me?key=${providerKey}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.provider.is_paused).toBe(true);
    expect(meRes.body.provider.status).toBe('paused');
  });

  test('POST /api/providers/resume clears pause flag', async () => {
    await request(app).post('/api/providers/pause').send({ key: providerKey });

    const resumeRes = await request(app)
      .post('/api/providers/resume')
      .send({ key: providerKey });

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.success).toBe(true);
    expect(['connected', 'online']).toContain(resumeRes.body.status);

    const meRes = await request(app).get(`/api/providers/me?key=${providerKey}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.provider.is_paused).toBe(false);
  });

  test('POST /api/providers/preferences updates provider preferences', async () => {
    const res = await request(app)
      .post('/api/providers/preferences')
      .send({
        key: providerKey,
        run_mode: 'scheduled',
        gpu_usage_cap_pct: 60,
        temp_limit_c: 75,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences.run_mode).toBe('scheduled');
    expect(res.body.preferences.gpu_usage_cap_pct).toBe(60);
    expect(res.body.preferences.temp_limit_c).toBe(75);
  });

  test('POST /api/providers/preferences rejects invalid run_mode', async () => {
    const res = await request(app)
      .post('/api/providers/preferences')
      .send({
        key: providerKey,
        run_mode: 'invalid',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid run_mode');
  });

  test('GET /api/providers/download returns executable installer script', async () => {
    const res = await request(app)
      .get(`/api/providers/download?key=${providerKey}&platform=windows`);

    const script = res.text || (Buffer.isBuffer(res.body) ? res.body.toString('utf8') : '');

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('dc1-setup.ps1');
    expect(script).toContain('DCP Provider Daemon - Windows Installer');
    expect(script).toContain('/api/providers/download/daemon?key=$ApiKey');
    expect(script).toContain('--key $ApiKey --url $ApiUrl');
  });
});
