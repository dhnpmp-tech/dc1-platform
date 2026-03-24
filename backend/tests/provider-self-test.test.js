const request = require('supertest');
const express = require('express');
const db = require('../src/db');
const providersRouter = require('../src/routes/providers');

describe('Provider Self-Test & Activation Endpoints (DCP-802)', () => {
    let app;
    let testProvider;
    let testApiKey;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/providers', providersRouter);
    });

    beforeEach(() => {
        // Clean up test data
        db.run('DELETE FROM providers');

        // Create a test provider
        testApiKey = 'test_provider_key_' + Date.now();
        const result = db.run(`
            INSERT INTO providers (
                name, email, gpu_model, vram_mb, api_key, status, last_heartbeat
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
            'Test Provider',
            'test@example.com',
            'RTX 4090',
            24576,  // 24GB
            testApiKey,
            'pending',
            new Date().toISOString()
        );

        testProvider = {
            id: result.lastInsertRowid,
            name: 'Test Provider',
            email: 'test@example.com',
            gpu_model: 'RTX 4090',
            vram_mb: 24576,
            api_key: testApiKey,
            status: 'pending',
        };
    });

    afterEach(() => {
        db.run('DELETE FROM providers');
    });

    describe('GET /api/providers/self-test', () => {
        it('should return 401 when no API key provided', async () => {
            const res = await request(app)
                .get('/api/providers/self-test')
                .expect(401);

            expect(res.body.ready).toBe(false);
            expect(res.body.checks.key_valid).toBe(false);
            expect(res.body.next_step).toBe('missing_key');
        });

        it('should return 401 for invalid API key', async () => {
            const res = await request(app)
                .get('/api/providers/self-test')
                .set('Authorization', 'Bearer invalid_key_123')
                .expect(401);

            expect(res.body.ready).toBe(false);
            expect(res.body.checks.key_valid).toBe(false);
            expect(res.body.next_step).toBe('invalid_key');
        });

        it('should return ready=true when all checks pass', async () => {
            const res = await request(app)
                .get('/api/providers/self-test')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.ready).toBe(true);
            expect(res.body.checks.key_valid).toBe(true);
            expect(res.body.checks.gpu_detected).toBe(true);
            expect(res.body.checks.docker_accessible).toBe(true);
            expect(res.body.checks.network_reachable).toBe(true);
            expect(res.body.checks.vram_available_gb).toBe(24);
            expect(res.body.next_step).toBe('activate');
            expect(res.body.provider_id).toBe(testProvider.id);
            expect(res.body.gpu_model).toBe('RTX 4090');
            expect(res.body.status).toBe('pending');
        });

        it('should return ready=false when GPU not detected', async () => {
            db.run('UPDATE providers SET gpu_model = NULL, vram_mb = NULL WHERE id = ?', testProvider.id);

            const res = await request(app)
                .get('/api/providers/self-test')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.ready).toBe(false);
            expect(res.body.checks.gpu_detected).toBe(false);
            expect(res.body.next_step).toBe('fix_gpu');
        });

        it('should return ready=false when docker not accessible (no heartbeat)', async () => {
            db.run('UPDATE providers SET last_heartbeat = NULL WHERE id = ?', testProvider.id);

            const res = await request(app)
                .get('/api/providers/self-test')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.ready).toBe(false);
            expect(res.body.checks.docker_accessible).toBe(false);
            expect(res.body.next_step).toBe('fix_docker');
        });

        it('should return ready=false when network unreachable (old heartbeat)', async () => {
            const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            db.run('UPDATE providers SET last_heartbeat = ? WHERE id = ?', oldTime, testProvider.id);

            const res = await request(app)
                .get('/api/providers/self-test')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.ready).toBe(false);
            expect(res.body.checks.network_reachable).toBe(false);
            expect(res.body.next_step).toBe('fix_network');
        });

        it('should return ready=false when VRAM < 4GB', async () => {
            db.run('UPDATE providers SET vram_mb = ? WHERE id = ?', 2048, testProvider.id);

            const res = await request(app)
                .get('/api/providers/self-test')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.ready).toBe(false);
            expect(res.body.checks.vram_available_gb).toBe(2);
        });

        it('should accept x-provider-key header as alternative auth', async () => {
            const res = await request(app)
                .get('/api/providers/self-test')
                .set('x-provider-key', testApiKey)
                .expect(200);

            expect(res.body.ready).toBe(true);
            expect(res.body.checks.key_valid).toBe(true);
        });
    });

    describe('POST /api/providers/activate', () => {
        it('should return 401 when no API key provided', async () => {
            const res = await request(app)
                .post('/api/providers/activate')
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.reason).toBe('API key required');
        });

        it('should return 401 for invalid API key', async () => {
            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', 'Bearer invalid_key_123')
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.reason).toBe('Invalid API key');
        });

        it('should activate provider successfully', async () => {
            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.activated).toBe(true);
            expect(res.body.provider_id).toBe(testProvider.id);
            expect(res.body.status).toBe('online');
            expect(res.body.gpu_model).toBe('RTX 4090');
            expect(res.body.vram_available_gb).toBe(24);
            expect(res.body.estimated_monthly_earnings_halala).toBeGreaterThan(0);
            expect(Array.isArray(res.body.next_steps)).toBe(true);

            const updatedProvider = db.get('SELECT status FROM providers WHERE id = ?', testProvider.id);
            expect(updatedProvider.status).toBe('online');
        });

        it('should return 200 if provider already online', async () => {
            db.run('UPDATE providers SET status = ? WHERE id = ?', 'online', testProvider.id);

            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.activated).toBe(false);
            expect(res.body.reason).toBe('Provider already online');
            expect(res.body.status).toBe('online');
        });

        it('should return 422 when GPU model missing', async () => {
            db.run('UPDATE providers SET gpu_model = NULL WHERE id = ?', testProvider.id);

            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(422);

            expect(res.body.success).toBe(false);
            expect(res.body.reason).toContain('Insufficient hardware');
        });

        it('should return 422 when VRAM < 4GB', async () => {
            db.run('UPDATE providers SET vram_mb = ? WHERE id = ?', 2048, testProvider.id);

            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(422);

            expect(res.body.success).toBe(false);
            expect(res.body.reason).toContain('Insufficient hardware');
        });

        it('should calculate correct earnings for RTX 4090', async () => {
            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            // RTX 4090: 26.7 halalas/hr * 720 hours/month * 0.7 utilization = 13,464 halalas
            const expected = Math.round(26.7 * 720 * 0.7);
            expect(res.body.estimated_monthly_earnings_halala).toBe(expected);
        });

        it('should handle different GPU models', async () => {
            db.run('UPDATE providers SET gpu_model = ? WHERE id = ?', 'NVIDIA H100', testProvider.id);

            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            // H100: 53.4 halalas/hr * 720 hours/month * 0.7 utilization = 26,928 halalas
            const expected = Math.round(53.4 * 720 * 0.7);
            expect(res.body.estimated_monthly_earnings_halala).toBe(expected);
        });

        it('should accept x-provider-key header as alternative auth', async () => {
            const res = await request(app)
                .post('/api/providers/activate')
                .set('x-provider-key', testApiKey)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.activated).toBe(true);
        });

        it('should use fallback price for unknown GPU model', async () => {
            db.run('UPDATE providers SET gpu_model = ? WHERE id = ?', 'CUSTOM_GPU_MODEL', testProvider.id);

            const res = await request(app)
                .post('/api/providers/activate')
                .set('Authorization', `Bearer ${testApiKey}`)
                .expect(200);

            // Should default to RTX 4090 pricing
            const expected = Math.round(26.7 * 720 * 0.7);
            expect(res.body.estimated_monthly_earnings_halala).toBe(expected);
        });
    });
});
