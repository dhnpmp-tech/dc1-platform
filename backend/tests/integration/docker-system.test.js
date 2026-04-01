'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawnSync: jest.fn(),
  };
});

const { spawnSync } = require('child_process');
const db = require('../../src/db');

const DIGEST = `sha256:${'a'.repeat(64)}`;
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  app.use('/api/admin', require('../../src/routes/admin'));
  app.use('/api/containers', require('../../src/routes/containers'));
  return app;
}

const app = createApp();

function cleanDb() {
  const tables = [
    'job_logs',
    'job_executions',
    'escrow_holds',
    'jobs',
    'renter_quota',
    'quota_log',
    'allowed_images',
    'approved_container_images',
    'image_scans',
    'admin_rate_limit_log',
    'renters',
    'providers',
  ];

  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (_) {}
  }
}

function mockImageApprovalCommands() {
  spawnSync.mockImplementation((command, args) => {
    const argv = Array.isArray(args) ? args : [];

    if (command === 'docker' && argv[0] === 'manifest' && argv[1] === 'inspect') {
      return { status: 0, stdout: '{}', stderr: '' };
    }
    if (command === 'docker' && argv[0] === 'pull') {
      return { status: 0, stdout: 'ok', stderr: '' };
    }
    if (command === 'docker' && argv[0] === 'image' && argv[1] === 'inspect') {
      return {
        status: 0,
        stdout: JSON.stringify([`docker.io/library/ubuntu@${DIGEST}`]),
        stderr: '',
      };
    }
    if (command === 'trivy' && argv[0] === 'image') {
      return { status: 0, stdout: JSON.stringify({ Results: [] }), stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  });
}

async function registerProvider(overrides = {}) {
  const res = await request(app).post('/api/providers/register').send({
    name: overrides.name || 'Provider Test',
    email: overrides.email || `provider-${Date.now()}-${Math.random().toString(36).slice(2)}@dcp.test`,
    gpu_model: overrides.gpu_model || 'RTX 4090',
    os: overrides.os || 'linux',
  });
  return {
    status: res.status,
    body: res.body,
    providerKey: res.body.api_key,
    providerId: res.body.provider_id,
  };
}

async function registerRenter(overrides = {}) {
  const res = await request(app).post('/api/renters/register').send({
    name: overrides.name || 'Renter Test',
    email: overrides.email || `renter-${Date.now()}-${Math.random().toString(36).slice(2)}@dcp.test`,
  });

  if (overrides.balance_halala != null) {
    db.prepare('UPDATE renters SET balance_halala = ? WHERE id = ?').run(overrides.balance_halala, res.body.renter_id);
  }

  return {
    status: res.status,
    body: res.body,
    renterKey: res.body.api_key,
    renterId: res.body.renter_id,
  };
}

function setProviderCapabilities(providerId, { vramMb, gpuCount }) {
  db.prepare(
    `UPDATE providers
     SET status = 'online',
         last_heartbeat = ?,
         vram_mb = ?,
         gpu_count_reported = ?,
         is_paused = 0
     WHERE id = ?`
  ).run(new Date().toISOString(), vramMb, gpuCount, providerId);
}

async function submitContainerJob(renterKey, overrides = {}) {
  return request(app)
    .post('/api/jobs/submit')
    .set('x-renter-key', renterKey)
    .send({
      job_type: 'llm_inference',
      duration_minutes: 1,
      ...overrides,
      container_spec: overrides.container_spec || {
        image_type: 'llm',
        image: 'dcp/vllm-serve:latest',
        vram_required_mb: 4096,
        gpu_count: 1,
        compute_type: 'inference',
      },
    });
}

async function createRunningJob() {
  const { providerKey, providerId } = await registerProvider();
  setProviderCapabilities(providerId, { vramMb: 24576, gpuCount: 1 });

  const { renterKey } = await registerRenter({ balance_halala: 50_000 });
  const submitRes = await submitContainerJob(renterKey, { provider_id: providerId });
  const jobId = submitRes.body.job.job_id;

  await request(app).get(`/api/providers/jobs/next?key=${providerKey}`);

  return { providerKey, providerId, renterKey, jobId };
}

beforeEach(() => {
  cleanDb();
  spawnSync.mockReset();
  mockImageApprovalCommands();
});

afterAll(() => {
  cleanDb();
});

describe('DCP-324 Docker wave integration suite', () => {
  describe('container_spec validation (DCP-311)', () => {
    it('accepts legacy non-container submit without container_spec', async () => {
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const res = await request(app)
        .post('/api/jobs/submit')
        .set('x-renter-key', renterKey)
        .send({
          job_type: 'llm_inference',
          duration_minutes: 1,
          params: { prompt: 'hello' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.container_spec).toEqual(expect.objectContaining({
        image_type: 'llm',
        compute_type: 'inference',
      }));
    });

    it('rejects submit with invalid image_type', async () => {
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const res = await submitContainerJob(renterKey, {
        container_spec: {
          image_type: 123,
          image: 'dcp/vllm-serve:latest',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/image_type is required/i);
    });

    it('rejects submit with unapproved image', async () => {
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const res = await submitContainerJob(renterKey, {
        container_spec: {
          image_type: 'llm',
          image: 'ghcr.io/acme/private-worker:1.2.3',
          vram_required_mb: 4096,
          gpu_count: 1,
          compute_type: 'inference',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not approved/i);
    });

    it('accepts valid container_spec', async () => {
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const res = await submitContainerJob(renterKey, {
        container_spec: {
          image_type: 'llm',
          image: 'dcp/vllm-serve:latest',
          vram_required_mb: 4096,
          gpu_count: 1,
          compute_type: 'inference',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.container_spec.image).toBe('dcp/vllm-serve:latest');
    });

    it('rejects raw Python task_spec', async () => {
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const res = await request(app)
        .post('/api/jobs/submit')
        .set('x-renter-key', renterKey)
        .send({
          job_type: 'llm_inference',
          duration_minutes: 1,
          task_spec: 'import os\nprint("unsafe")',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Raw Python task_spec is not allowed/i);
    });
  });

  describe('container registry (DCP-315)', () => {
    it('lists template images + approved images', async () => {
      const approveRes = await request(app)
        .post('/api/admin/containers/approve-image')
        .set('x-admin-token', ADMIN_TOKEN)
        .send({
          image_ref: `docker.io/library/ubuntu:22.04@${DIGEST}`,
          image_type: 'docker_hub',
          description: 'Ubuntu test image',
        });
      expect(approveRes.status).toBe(201);

      const registryRes = await request(app).get('/api/containers/registry');
      expect(registryRes.status).toBe(200);
      expect(Array.isArray(registryRes.body.images)).toBe(true);
      expect(registryRes.body.images.length).toBeGreaterThan(0);
      expect(registryRes.body.images.some((img) => img.source === 'template')).toBe(true);
      expect(registryRes.body.images.some((img) => img.image_ref === `docker.io/library/ubuntu:22.04@${DIGEST}`)).toBe(true);
    });

    it('rejects image approval for untrusted registry', async () => {
      const res = await request(app)
        .post('/api/admin/containers/approve-image')
        .set('x-admin-token', ADMIN_TOKEN)
        .send({
          image_ref: `evil.example.com/app/worker:1.0@${DIGEST}`,
          image_type: 'custom',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not trusted/i);
    });

    it('rejects Docker Hub image approval without SHA256 pin', async () => {
      const res = await request(app)
        .post('/api/admin/containers/approve-image')
        .set('x-admin-token', ADMIN_TOKEN)
        .send({
          image_ref: 'hub.docker.com/r/library/ubuntu:22.04',
          image_type: 'docker_hub',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/sha256-pinned/i);
    });

    it('approves valid pinned image', async () => {
      const res = await request(app)
        .post('/api/admin/containers/approve-image')
        .set('x-admin-token', ADMIN_TOKEN)
        .send({
          image_ref: `docker.io/library/ubuntu:22.04@${DIGEST}`,
          image_type: 'docker_hub',
          description: 'Pinned Ubuntu',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.image.image_ref).toBe(`docker.io/library/ubuntu:22.04@${DIGEST}`);
      expect(res.body.resolved_digest).toBe(DIGEST);
    });
  });

  describe('GPU routing / queue (DCP-317)', () => {
    it('keeps a 16GB job queued when only 8GB provider is online', async () => {
      const { providerKey, providerId } = await registerProvider();
      setProviderCapabilities(providerId, { vramMb: 8192, gpuCount: 1 });
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });

      const submitRes = await submitContainerJob(renterKey, {
        gpu_requirements: { min_vram_gb: 16 },
        container_spec: {
          image_type: 'training',
          image: 'dcp/training:latest',
          vram_required_mb: 16384,
          gpu_count: 1,
          compute_type: 'training',
        },
      });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.job.status).toBe('queued');

      const nextJobRes = await request(app).get(`/api/providers/jobs/next?key=${providerKey}`);
      expect(nextJobRes.status).toBe(200);
      expect(nextJobRes.body.job).toBeNull();
      expect(nextJobRes.body.admission).toEqual(expect.objectContaining({
        accepted: false,
        reason_code: 'INSUFFICIENT_VRAM',
      }));

      const stored = db.prepare('SELECT status FROM jobs WHERE job_id = ?').get(submitRes.body.job.job_id);
      expect(stored.status).toBe('queued');
    });

    it('assigns a 16GB job to a 24GB provider', async () => {
      const { providerId: lowProviderId } = await registerProvider();
      setProviderCapabilities(lowProviderId, { vramMb: 8192, gpuCount: 1 });

      const { providerKey: highProviderKey, providerId: highProviderId } = await registerProvider();
      setProviderCapabilities(highProviderId, { vramMb: 24576, gpuCount: 1 });

      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const submitRes = await submitContainerJob(renterKey, {
        gpu_requirements: { min_vram_gb: 16 },
        container_spec: {
          image_type: 'training',
          image: 'dcp/training:latest',
          vram_required_mb: 16384,
          gpu_count: 1,
          compute_type: 'training',
        },
      });

      expect(submitRes.status).toBe(201);

      const nextJobRes = await request(app).get(`/api/providers/jobs/next?key=${highProviderKey}`);
      expect(nextJobRes.status).toBe(200);
      expect(nextJobRes.body.job).toBeTruthy();
      expect(nextJobRes.body.job.job_id).toBe(submitRes.body.job.job_id);

      const stored = db.prepare('SELECT status, provider_id FROM jobs WHERE job_id = ?').get(submitRes.body.job.job_id);
      expect(stored.status).toBe('running');
      expect(stored.provider_id).toBe(highProviderId);
    });

    it('returns deterministic reason code when instant-tier model is not cached on provider', async () => {
      const modelId = 'dcp-tests/instant-tier-hot-model';
      db.prepare(
        `INSERT OR REPLACE INTO model_registry
         (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(
        modelId,
        'Instant Tier Test Model',
        'dcp-tests',
        8,
        'fp16',
        4096,
        JSON.stringify(['test']),
        8,
        10,
        new Date().toISOString(),
        new Date().toISOString()
      );
      db.prepare('UPDATE model_registry SET prewarm_class = ? WHERE model_id = ?').run('hot', modelId);

      const { providerKey, providerId } = await registerProvider();
      setProviderCapabilities(providerId, { vramMb: 24576, gpuCount: 1 });
      db.prepare('UPDATE providers SET cached_models = ? WHERE id = ?').run(JSON.stringify([]), providerId);

      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const submitRes = await submitContainerJob(renterKey, {
        container_spec: {
          image_type: 'llm',
          image: 'dcp/vllm-serve:latest',
          vram_required_mb: 4096,
          gpu_count: 1,
          compute_type: 'inference',
          model_id: modelId,
        },
      });
      expect(submitRes.status).toBe(201);

      const nextJobRes = await request(app).get(`/api/providers/jobs/next?key=${providerKey}`);
      expect(nextJobRes.status).toBe(200);
      expect(nextJobRes.body.job).toBeNull();
      expect(nextJobRes.body.admission).toEqual(expect.objectContaining({
        accepted: false,
        reason_code: 'INSTANT_MODEL_NOT_CACHED',
        tier_mode: 'instant',
        model_id: modelId,
      }));
    });

    it('assigns instant-tier job after provider reports model cached', async () => {
      const modelId = 'dcp-tests/instant-tier-hot-model-2';
      db.prepare(
        `INSERT OR REPLACE INTO model_registry
         (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(
        modelId,
        'Instant Tier Test Model 2',
        'dcp-tests',
        8,
        'fp16',
        4096,
        JSON.stringify(['test']),
        8,
        10,
        new Date().toISOString(),
        new Date().toISOString()
      );
      db.prepare('UPDATE model_registry SET prewarm_class = ? WHERE model_id = ?').run('hot', modelId);

      const { providerKey, providerId } = await registerProvider();
      setProviderCapabilities(providerId, { vramMb: 24576, gpuCount: 1 });
      db.prepare('UPDATE providers SET cached_models = ? WHERE id = ?').run(JSON.stringify([modelId]), providerId);

      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const submitRes = await submitContainerJob(renterKey, {
        container_spec: {
          image_type: 'llm',
          image: 'dcp/vllm-serve:latest',
          vram_required_mb: 4096,
          gpu_count: 1,
          compute_type: 'inference',
          model_id: modelId,
        },
      });
      expect(submitRes.status).toBe(201);

      const nextJobRes = await request(app).get(`/api/providers/jobs/next?key=${providerKey}`);
      expect(nextJobRes.status).toBe(200);
      expect(nextJobRes.body.job).toBeTruthy();
      expect(nextJobRes.body.job.job_id).toBe(submitRes.body.job.job_id);
      expect(nextJobRes.body.admission).toEqual(expect.objectContaining({
        accepted: true,
        reason_code: 'ADMISSION_OK',
        tier_mode: 'instant',
        model_id: modelId,
      }));
    });

    it('returns queue depth grouped by compute_type', async () => {
      const { renterKey } = await registerRenter({ balance_halala: 20_000 });

      await submitContainerJob(renterKey, {
        gpu_requirements: { min_vram_gb: 24 },
        container_spec: {
          image_type: 'training',
          image: 'dcp/training:latest',
          vram_required_mb: 24576,
          gpu_count: 1,
          compute_type: 'training',
        },
      });
      await submitContainerJob(renterKey, {
        gpu_requirements: { min_vram_gb: 16 },
        container_spec: {
          image_type: 'llm',
          image: 'dcp/vllm-serve:latest',
          vram_required_mb: 16384,
          gpu_count: 1,
          compute_type: 'inference',
        },
      });

      const queueRes = await request(app)
        .get('/api/jobs/queue/status')
        .set('x-renter-key', renterKey);
      expect(queueRes.status).toBe(200);
      expect(queueRes.body.queued_total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(queueRes.body.buckets)).toBe(true);
      expect(queueRes.body.buckets.some((b) => b.compute_type === 'training')).toBe(true);
      expect(queueRes.body.buckets.some((b) => b.compute_type === 'inference')).toBe(true);
    });

    it('rejects queue status without authenticated actor', async () => {
      const res = await request(app).get('/api/jobs/queue/status');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('scopes queue status to renter-owned queued jobs', async () => {
      const { renterKey: renterA } = await registerRenter({ balance_halala: 50_000 });
      const { renterKey: renterB } = await registerRenter({ balance_halala: 50_000 });

      const submitA = await submitContainerJob(renterA, {
        container_spec: {
          image_type: 'training',
          image: 'dcp/training:latest',
          vram_required_mb: 16384,
          gpu_count: 1,
          compute_type: 'training',
        },
      });
      const submitB = await submitContainerJob(renterB, {
        container_spec: {
          image_type: 'llm',
          image: 'dcp/vllm-serve:latest',
          vram_required_mb: 4096,
          gpu_count: 1,
          compute_type: 'inference',
        },
      });
      expect(submitA.status).toBe(201);
      expect(submitB.status).toBe(201);

      const queueA = await request(app)
        .get('/api/jobs/queue/status')
        .set('x-renter-key', renterA);
      expect(queueA.status).toBe(200);
      expect(queueA.body.queued_total).toBe(1);
      expect(queueA.body.queue).toHaveLength(1);
      expect(queueA.body.queue[0].compute_type).toBe('training');

      const queueB = await request(app)
        .get('/api/jobs/queue/status')
        .set('x-renter-key', renterB);
      expect(queueB.status).toBe(200);
      expect(queueB.body.queued_total).toBe(1);
      expect(queueB.body.queue).toHaveLength(1);
      expect(queueB.body.queue[0].compute_type).toBe('inference');
    });

    it('updates queue_position after earlier queued job is claimed', async () => {
      const { providerId: lowProviderId } = await registerProvider();
      setProviderCapabilities(lowProviderId, { vramMb: 8192, gpuCount: 1 });
      const { renterKey } = await registerRenter({ balance_halala: 40_000 });

      const firstSubmit = await submitContainerJob(renterKey, {
        gpu_requirements: { min_vram_gb: 16 },
        container_spec: {
          image_type: 'training',
          image: 'dcp/training:latest',
          vram_required_mb: 16384,
          gpu_count: 1,
          compute_type: 'training',
        },
      });
      const secondSubmit = await submitContainerJob(renterKey, {
        gpu_requirements: { min_vram_gb: 16 },
        container_spec: {
          image_type: 'training',
          image: 'dcp/training:latest',
          vram_required_mb: 16384,
          gpu_count: 1,
          compute_type: 'training',
        },
      });

      expect(firstSubmit.body.job.queue_position).toBe(1);
      expect(secondSubmit.body.job.queue_position).toBe(2);

      const { providerKey: highProviderKey, providerId: highProviderId } = await registerProvider();
      setProviderCapabilities(highProviderId, { vramMb: 24576, gpuCount: 1 });

      const claimRes = await request(app).get(`/api/providers/jobs/next?key=${highProviderKey}`);
      expect(claimRes.status).toBe(200);
      expect(claimRes.body.job.job_id).toBe(firstSubmit.body.job.job_id);

      const secondJobRes = await request(app)
        .get(`/api/jobs/${secondSubmit.body.job.job_id}`)
        .set('x-renter-key', renterKey);
      expect(secondJobRes.status).toBe(200);
      expect(secondJobRes.body.job.status).toBe('queued');
      expect(secondJobRes.body.job.queue_position).toBe(1);
    });
  });

  describe('job execution history (DCP-316)', () => {
    it('returns attempt history for the owning renter', async () => {
      const { renterKey, jobId } = await createRunningJob();

      const historyRes = await request(app)
        .get(`/api/jobs/${jobId}/history`)
        .set('x-renter-key', renterKey);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.job.job_id).toBe(jobId);
      expect(Array.isArray(historyRes.body.executions)).toBe(true);
      expect(historyRes.body.executions.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects history for non-owner renter key', async () => {
      const { jobId } = await createRunningJob();
      const { renterKey: wrongRenterKey } = await registerRenter();

      const historyRes = await request(app)
        .get(`/api/jobs/${jobId}/history`)
        .set('x-renter-key', wrongRenterKey);

      expect(historyRes.status).toBe(403);
    });

    it('returns attempt logs endpoint status (200 or 404 when file not yet written)', async () => {
      const { renterKey, jobId } = await createRunningJob();

      const logsRes = await request(app)
        .get(`/api/jobs/${jobId}/logs?attempt=1`)
        .set('x-renter-key', renterKey);

      expect([200, 404]).toContain(logsRes.status);
    });
  });

  describe('fault tolerance / restart semantics (DCP-315)', () => {
    it('keeps job running while restart_count is below failure threshold', async () => {
      const { jobId } = await createRunningJob();
      db.prepare('UPDATE jobs SET restart_count = ? WHERE job_id = ?').run(2, jobId);

      const row = db.prepare('SELECT status, restart_count FROM jobs WHERE job_id = ?').get(jobId);
      expect(row.restart_count).toBe(2);
      expect(row.status).toBe('running');
    });

    it('marks job failed when daemon reports restart_count=3 with non-zero exit', async () => {
      const { providerKey, jobId } = await createRunningJob();

      const resultRes = await request(app)
        .post('/api/providers/job-result')
        .send({
          api_key: providerKey,
          job_id: jobId,
          success: false,
          exit_code: 1,
          restart_count: 3,
          last_error: 'Container crashed repeatedly',
        });

      expect(resultRes.status).toBe(200);
      expect(resultRes.body.status).toBe('failed');
      expect(resultRes.body.restart_count).toBe(3);

      const row = db.prepare('SELECT status, restart_count, last_error FROM jobs WHERE job_id = ?').get(jobId);
      expect(row.status).toBe('failed');
      expect(row.restart_count).toBe(3);
      expect(row.last_error).toMatch(/crashed/i);
    });
  });

  describe('provider startup health gating', () => {
    it('does not assign queued jobs to provider with stale heartbeat (>10 min)', async () => {
      const { providerKey, providerId } = await registerProvider();
      const staleHeartbeat = new Date(Date.now() - (11 * 60 * 1000)).toISOString();
      db.prepare(
        `UPDATE providers
         SET status = 'online', is_paused = 0, last_heartbeat = ?, vram_mb = ?, gpu_count_reported = ?
         WHERE id = ?`
      ).run(staleHeartbeat, 24576, 1, providerId);

      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const submitRes = await submitContainerJob(renterKey, { provider_id: providerId });
      expect(submitRes.status).toBe(201);

      const nextRes = await request(app).get(`/api/providers/jobs/next?key=${providerKey}`);
      expect(nextRes.status).toBe(200);
      expect(nextRes.body.job).toBeNull();

      const row = db.prepare('SELECT status, picked_up_at FROM jobs WHERE job_id = ?').get(submitRes.body.job.job_id);
      expect(row.status).toMatch(/queued|pending/);
      expect(row.picked_up_at).toBeNull();
    });

    it('assigns queued jobs to degraded-but-online provider (<10 min heartbeat age)', async () => {
      const { providerKey, providerId } = await registerProvider();
      const degradedHeartbeat = new Date(Date.now() - (5 * 60 * 1000)).toISOString();
      db.prepare(
        `UPDATE providers
         SET status = 'online', is_paused = 0, last_heartbeat = ?, vram_mb = ?, gpu_count_reported = ?
         WHERE id = ?`
      ).run(degradedHeartbeat, 24576, 1, providerId);

      const { renterKey } = await registerRenter({ balance_halala: 20_000 });
      const submitRes = await submitContainerJob(renterKey, { provider_id: providerId });
      expect(submitRes.status).toBe(201);

      const nextRes = await request(app).get(`/api/providers/jobs/next?key=${providerKey}`);
      expect(nextRes.status).toBe(200);
      expect(nextRes.body.job).toBeTruthy();
      expect(nextRes.body.job.job_id).toBe(submitRes.body.job.job_id);

      const row = db.prepare('SELECT status, picked_up_at FROM jobs WHERE job_id = ?').get(submitRes.body.job.job_id);
      expect(row.status).toBe('running');
      expect(row.picked_up_at).toBeTruthy();
    });
  });
});
