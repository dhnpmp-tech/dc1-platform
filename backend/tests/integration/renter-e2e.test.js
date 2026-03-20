'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';
if (!process.env.DC1_ADMIN_TOKEN) process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';

const crypto = require('crypto');
const express = require('express');
const http = require('http');
const request = require('supertest');
const db = require('../../src/db');
const { cleanDb, registerProvider, registerRenter, bringOnline } = require('./helpers');
const { createRateLimiter } = require('../../src/middleware/rateLimiter');

function createE2EApp() {
  const app = express();
  app.use(express.json());

  const submitLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
      const renterKey = req.headers['x-renter-key'] || req.query.renter_key || req.query.key;
      if (renterKey) return `renter:${String(renterKey)}`;
      const providerKey = req.headers['x-provider-key'] || req.query.provider_key;
      if (providerKey) return `provider:${String(providerKey)}`;
      return `ip:${req.ip || 'unknown'}`;
    },
  });

  app.use('/api/jobs/submit', submitLimiter);
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  return app;
}

async function startServer(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function startWebhookMockServer() {
  const received = [];
  const app = express();
  app.use(express.text({ type: '*/*' }));
  app.post('/webhook', (req, res) => {
    received.push({
      headers: req.headers,
      rawBody: req.body || '',
      parsedBody: (() => {
        try { return JSON.parse(req.body || '{}'); } catch { return null; }
      })(),
    });
    res.status(200).json({ ok: true });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    received,
    url: `http://127.0.0.1:${server.address().port}/webhook`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function waitFor(predicate, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error('Timed out waiting for condition'));
      setTimeout(tick, 25);
    };
    tick();
  });
}

function readFirstSseLogEvent({ baseUrl, jobId, renterKey, timeoutMs = 2000 }) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/jobs/${jobId}/logs/stream?key=${encodeURIComponent(renterKey)}`, baseUrl);
    const req = http.request(url, { method: 'GET' }, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (chunk) => { errBody += chunk.toString(); });
        res.on('end', () => reject(new Error(`SSE failed: ${res.statusCode} ${errBody}`)));
        return;
      }

      let buffer = '';
      const onData = (chunk) => {
        buffer += chunk.toString();
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const eventBlock of events) {
          const lines = eventBlock.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice('data: '.length).trim();
            let payload;
            try { payload = JSON.parse(jsonStr); } catch (_) { continue; }
            if (payload.type === 'log') {
              cleanup();
              resolve(payload);
              return;
            }
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        res.off('data', onData);
        req.destroy();
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for first SSE log event'));
      }, timeoutMs);

      res.on('data', onData);
    });

    req.on('error', reject);
    req.end();
  });
}

async function pollJobStatus(app, jobId, renterKey, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await request(app).get(`/api/jobs/${jobId}`).query({ key: renterKey });
    if (res.status === 200 && ['done', 'completed', 'failed', 'cancelled'].includes(String(res.body?.job?.status))) {
      return res;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for terminal job status');
}

describe('Renter E2E integration (register → job → log stream → webhook)', () => {
  let app;

  beforeEach(() => {
    cleanDb();
    app = createE2EApp();
  });

  it('runs full renter flow with SSE log stream + signed webhook callback', async () => {
    const webhookMock = await startWebhookMockServer();
    const appServer = await startServer(app);
    try {
      const provider = await registerProvider(request, app, {
        name: 'E2E Provider',
        gpu_model: 'RTX 4090',
        os: 'Linux',
      });
      expect(provider.status).toBe(200);
      expect(provider.apiKey).toMatch(/^dc1-provider-/);
      expect(provider.providerId).toBeDefined();
      expect(Number.isInteger(provider.providerId)).toBe(true);

      const heartbeat = await bringOnline(request, app, provider.apiKey);
      expect(heartbeat.status).toBe(200);
      expect(heartbeat.body).toEqual(expect.objectContaining({ success: true }));

      const renter = await registerRenter(request, app, {
        name: 'E2E Renter',
        email: `renter-e2e-${Date.now()}@dc1.test`,
      });
      expect(renter.status).toBe(201);
      expect(renter.apiKey).toMatch(/^dc1-renter-/);
      expect(renter.renterId).toBeDefined();

      db.prepare('UPDATE renters SET balance_halala = 0, webhook_url = ? WHERE id = ?').run(webhookMock.url, renter.renterId);

      const meZero = await request(app).get('/api/renters/me').query({ key: renter.apiKey });
      expect(meZero.status).toBe(200);
      expect(meZero.body).toEqual(expect.objectContaining({
        renter: expect.objectContaining({
          id: renter.renterId,
          balance_halala: 0,
        }),
        recent_jobs: expect.any(Array),
      }));

      db.prepare('UPDATE renters SET balance_halala = 50000 WHERE id = ?').run(renter.renterId);

      const marketplace = await request(app).get('/api/providers/marketplace');
      expect(marketplace.status).toBe(200);
      expect(Array.isArray(marketplace.body)).toBe(true);
      expect(marketplace.body.length).toBeGreaterThan(0);
      expect(marketplace.body[0]).toEqual(expect.objectContaining({
        id: expect.any(Number),
        gpu_model: expect.any(String),
        rate_halala: expect.any(Number),
      }));

      const submit = await request(app)
        .post('/api/jobs/submit')
        .set('x-renter-key', renter.apiKey)
        .send({
          provider_id: provider.providerId,
          job_type: 'llm_inference',
          duration_minutes: 10,
          params: { prompt: 'Hello from renter E2E', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
        });
      expect(submit.status).toBe(201);
      expect(submit.body).toEqual(expect.objectContaining({
        success: true,
        job: expect.objectContaining({
          job_id: expect.any(String),
          provider_id: provider.providerId,
          renter_id: renter.renterId,
          status: expect.any(String),
          cost_halala: expect.any(Number),
        }),
      }));
      const jobId = submit.body.job.job_id;
      const estimatedCost = submit.body.job.cost_halala;

      const assigned = await request(app).get('/api/jobs/assigned').query({ key: provider.apiKey });
      expect(assigned.status).toBe(200);
      expect(assigned.body).toEqual(expect.objectContaining({
        job: expect.objectContaining({
          job_id: jobId,
          status: 'assigned',
        }),
      }));

      const sseFirstLogPromise = readFirstSseLogEvent({
        baseUrl: appServer.baseUrl,
        jobId,
        renterKey: renter.apiKey,
        timeoutMs: 2000,
      });

      const logWrite = await request(app)
        .post(`/api/jobs/${jobId}/logs`)
        .send({
          api_key: provider.apiKey,
          lines: [{ level: 'info', message: 'container started' }],
        });
      expect(logWrite.status).toBe(200);
      expect(logWrite.body).toEqual(expect.objectContaining({
        success: true,
        lines_written: expect.any(Number),
      }));

      const firstLogEvent = await sseFirstLogPromise;
      expect(firstLogEvent).toEqual(expect.objectContaining({
        type: 'log',
        line: expect.stringContaining('container started'),
        ts: expect.any(Number),
      }));

      const result = await request(app)
        .post(`/api/jobs/${jobId}/result`)
        .set('x-provider-key', provider.apiKey)
        .send({ result: 'ok', duration_seconds: 600 });
      expect(result.status).toBe(200);
      expect(result.body).toEqual(expect.objectContaining({
        success: true,
        job: expect.objectContaining({
          job_id: jobId,
          status: 'completed',
        }),
        billing: expect.objectContaining({
          actual_cost_halala: expect.any(Number),
          provider_earned_halala: expect.any(Number),
          dc1_fee_halala: expect.any(Number),
        }),
      }));

      const completed = await pollJobStatus(app, jobId, renter.apiKey, 5000);
      expect(completed.status).toBe(200);
      expect(completed.body.job.status).toBe('completed');
      expect(completed.body.job.actual_cost_halala).toBeGreaterThan(0);

      const meAfter = await request(app).get('/api/renters/me').query({ key: renter.apiKey });
      expect(meAfter.status).toBe(200);
      expect(meAfter.body).toEqual(expect.objectContaining({
        renter: expect.objectContaining({
          id: renter.renterId,
          balance_halala: expect.any(Number),
        }),
      }));
      expect(meAfter.body.renter.balance_halala).toBe(50000 - estimatedCost);

      await waitFor(() => webhookMock.received.length > 0, 2000);
      const callback = webhookMock.received[0];
      expect(callback).toEqual(expect.objectContaining({
        headers: expect.objectContaining({
          'x-dcp-event': 'job.completed',
          'x-dcp-signature': expect.any(String),
        }),
        parsedBody: expect.objectContaining({
          event: 'job.completed',
          job: expect.objectContaining({
            job_id: jobId,
            renter_id: renter.renterId,
            provider_id: provider.providerId,
          }),
          billing: expect.objectContaining({
            actual_cost_halala: expect.any(Number),
          }),
        }),
      }));

      const expectedSig = crypto
        .createHmac('sha256', renter.apiKey)
        .update(callback.rawBody)
        .digest('hex');
      expect(callback.headers['x-dcp-signature']).toBe(expectedSig);
    } finally {
      await Promise.all([appServer.close(), webhookMock.close()]);
    }
  });

  it('returns 429 on the 11th job submit within one minute for the same renter key', async () => {
    const provider = await registerProvider(request, app, {
      name: 'Rate Provider',
      gpu_model: 'RTX 4090',
      os: 'Linux',
    });
    await bringOnline(request, app, provider.apiKey);

    const renter = await registerRenter(request, app, {
      name: 'Rate Renter',
      email: `rate-renter-${Date.now()}@dc1.test`,
      balanceHalala: 50000,
    });
    db.prepare('UPDATE renters SET balance_halala = 50000 WHERE id = ?').run(renter.renterId);

    for (let i = 0; i < 10; i++) {
      const ok = await request(app)
        .post('/api/jobs/submit')
        .set('x-renter-key', renter.apiKey)
        .send({
          provider_id: provider.providerId,
          job_type: 'llm_inference',
          duration_minutes: 1,
          params: { prompt: `rate-limit-${i}`, model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
        });
      expect(ok.status).toBe(201);
      expect(ok.body).toEqual(expect.objectContaining({
        success: true,
        job: expect.objectContaining({ job_id: expect.any(String) }),
      }));
    }

    const blocked = await request(app)
      .post('/api/jobs/submit')
      .set('x-renter-key', renter.apiKey)
      .send({
        provider_id: provider.providerId,
        job_type: 'llm_inference',
        duration_minutes: 1,
        params: { prompt: 'rate-limit-11', model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0' },
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual(expect.objectContaining({
      error: expect.any(String),
      retryAfterMs: expect.any(Number),
    }));
  });
});
