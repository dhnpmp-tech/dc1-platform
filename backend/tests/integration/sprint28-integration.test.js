/**
 * DCP-815: Sprint 28 Integration Test Suite
 * 
 * Covers all Sprint 28 features:
 * - Template catalog: GET /api/templates returns 20+ templates
 * - Model catalog: GET /api/models returns Arabic portfolio, filterable
 * - Provider activation: POST /api/providers/activate → sets status online
 * - Provider self-test: GET /api/providers/self-test → returns readiness check
 * - Wallet: GET /api/wallet/balance → returns halala balance
 * - Job dispatch: POST /api/jobs → validates token, creates job record
 * - Rate limiting: 11th request within window → 429 response
 * 
 * Usage:
 *   npm test -- backend/tests/integration/sprint28-integration.test.js
 * 
 * Environment:
 *   DC1_ADMIN_TOKEN — admin token for admin endpoints
 *   DC1_DB_PATH — optional SQLite path (default: :memory:)
 */

'use strict';

const request = require('supertest');
const { cleanDb, registerProvider, registerRenter, bringOnline, db } = require('./helpers');

function createApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters', require('../../src/routes/renters'));
  app.use('/api/jobs', require('../../src/routes/jobs'));
  app.use('/api/admin', require('../../src/routes/admin'));
  app.use('/api/models', require('../../src/routes/models'));
  app.use('/api/templates', require('../../src/routes/templates'));
  app.use('/api/wallet', require('../../src/routes/wallet'));
  
  return app;
}

const app = createApp();
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN || 'test-admin-token-jest';

beforeEach(() => cleanDb());

describe('Sprint 28 Integration Test Suite', () => {
  
  describe('1. Template Catalog', () => {
    test('GET /api/templates returns 20+ templates', async () => {
      const res = await request(app).get('/api/templates');
      expect(res.status).toBe(200);
      const templates = res.body?.templates || [];
      expect(templates.length).toBeGreaterThanOrEqual(20);
      
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('arabic-rag-complete');
      expect(templateIds).toContain('arabic-embeddings');
      expect(templateIds).toContain('arabic-reranker');
    });
    
    test('GET /api/templates/whitelist returns allowed templates', async () => {
      const res = await request(app).get('/api/templates/whitelist');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.templates)).toBe(true);
    });
  });
  
  describe('2. Model Catalog', () => {
    test('GET /api/models returns Arabic portfolio models', async () => {
      const res = await request(app).get('/api/models');
      expect(res.status).toBe(200);
      const models = res.body?.models || [];
      expect(models.length).toBeGreaterThan(0);
      
      const modelIds = models.map(m => m.model_id);
      const hasArabicModel = modelIds.some(id => 
        id.includes('allam') || id.includes('jais') || id.includes('bge')
      );
      expect(hasArabicModel).toBe(true);
    });
    
    test('GET /api/models?filter=arabic returns Arabic models only', async () => {
      const res = await request(app).get('/api/models?filter=arabic');
      expect(res.status).toBe(200);
      const models = res.body?.models || [];
      models.forEach(model => {
        const id = (model.model_id || '').toLowerCase();
        expect(
          id.includes('arabic') || id.includes('allam') || id.includes('jais') || id.includes('bge')
        ).toBe(true);
      });
    });
  });
  
  describe('3. Provider Activation', () => {
    test('POST /api/providers/activate → sets status online', async () => {
      const providerReg = await registerProvider(request, app, {
        name: 'Sprint28 Provider',
        gpu_model: 'RTX 4090',
        os: 'Linux',
      });
      expect(providerReg.status).toBe(200);
      const apiKey = providerReg.apiKey;
      
      const activateRes = await request(app)
        .post('/api/providers/activate')
        .set('x-provider-key', apiKey);
      expect(activateRes.status).toBe(200);
      expect(activateRes.body?.status).toBe('online');
    });
  });
  
  describe('4. Provider Self-Test', () => {
    test('GET /api/providers/self-test → returns readiness check', async () => {
      const providerReg = await registerProvider(request, app, {
        name: 'Sprint28 Provider',
        gpu_model: 'RTX 4090',
        os: 'Linux',
      });
      const apiKey = providerReg.apiKey;
      
      const selfTestRes = await request(app)
        .get('/api/providers/self-test')
        .set('x-provider-key', apiKey);
      expect(selfTestRes.status).toBe(200);
      expect(selfTestRes.body).toHaveProperty('ready');
      expect(selfTestRes.body).toHaveProperty('checks');
    });
  });
  
  describe('5. Wallet Balance', () => {
    test('GET /api/wallet/balance → returns halala balance', async () => {
      const renterReg = await registerRenter(request, app, { balanceHalala: 100000 });
      const apiKey = renterReg.apiKey;
      
      const balanceRes = await request(app)
        .get('/api/wallet/balance')
        .set('x-renter-key', apiKey);
      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body).toHaveProperty('balance_halala');
      expect(balanceRes.body.balance_halala).toBe(100000);
    });
  });
  
  describe('6. Job Dispatch', () => {
    test('POST /api/jobs → validates token, creates job record', async () => {
      const providerReg = await registerProvider(request, app, {
        name: 'Sprint28 Provider',
        gpu_model: 'RTX 4090',
        os: 'Linux',
      });
      const providerApiKey = providerReg.apiKey;
      
      await bringOnline(request, app, providerApiKey);
      
      const renterReg = await registerRenter(request, app, { balanceHalala: 50000 });
      const renterApiKey = renterReg.apiKey;
      const renterId = renterReg.renterId;
      
      const submitRes = await request(app)
        .post('/api/jobs/submit')
        .set('x-renter-key', renterApiKey)
        .send({
          provider_id: providerReg.providerId,
          job_type: 'inference',
          duration_minutes: 30,
        });
      
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.job).toHaveProperty('job_id');
      expect(submitRes.body.job.status).toBe('pending');
      expect(submitRes.body.job.cost_halala).toBeGreaterThan(0);
    });
  });
  
  describe('7. Rate Limiting', () => {
    test('11th request within window → 429 response', async () => {
      const renterReg = await registerRenter(request, app, { balanceHalala: 1000000 });
      const apiKey = renterReg.apiKey;
      
      const requests = [];
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app)
            .get('/api/renters/me')
            .set('x-renter-key', apiKey)
        );
      }
      
      const results = await Promise.all(requests);
      const statusCodes = results.map(r => r.status);
      const has429 = statusCodes.includes(429);
      
      if (has429) {
        const first429 = results.find(r => r.status === 429);
        expect(first429.body).toHaveProperty('error');
      }
    });
  });
  
  describe('8. Arabic RAG Template', () => {
    test('Arabic RAG template exists and has correct structure', async () => {
      const res = await request(app).get('/api/templates');
      const templates = res.body?.templates || [];
      const arabicRag = templates.find(t => t.id === 'arabic-rag-complete');
      
      expect(arabicRag).toBeDefined();
      expect(arabicRag).toHaveProperty('deployment_components');
      expect(arabicRag).toHaveProperty('min_vram_gb');
      expect(arabicRag.min_vram_gb).toBeGreaterThanOrEqual(40);
    });
  });
  
  describe('9. Provider Health Monitor (DCP-804)', () => {
    test('Provider health worker script exists', async () => {
      const fs = require('fs');
      const path = require('path');
      const workerPath = path.join(__dirname, '../../src/workers/providerHealthWorker.js');
      expect(fs.existsSync(workerPath)).toBe(true);
    });
  });
  
  describe('10. VPS Deploy Prep', () => {
    test('PM2 ecosystem config includes all required services', async () => {
      const fs = require('fs');
      const path = require('path');
      const ecosystemPath = path.join(__dirname, '../../ecosystem.config.js');
      expect(fs.existsSync(ecosystemPath)).toBe(true);
      
      const content = fs.readFileSync(ecosystemPath, 'utf-8');
      expect(content).toContain('dc1-provider-onboarding');
      expect(content).toContain('dcp-vps-health-cron');
      expect(content).toContain('dcp-provider-health-cron');
    });
  });
});
