const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');

function mockFlatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
}

jest.mock('../db', () => ({
  get run() { return (sql, ...params) => global.__testDb.prepare(sql).run(...mockFlatParams(params)); },
  get get() { return (sql, ...params) => global.__testDb.prepare(sql).get(...mockFlatParams(params)); },
  get all() { return (sql, ...params) => global.__testDb.prepare(sql).all(...mockFlatParams(params)); },
  get prepare() { return (sql) => global.__testDb.prepare(sql); },
  get _db() { return global.__testDb; },
  close: () => {},
}));

describe('admin notifications config', () => {
  const ADMIN_TOKEN = 'test-admin-token';

  function buildAdminApp() {
    const adminRoutePath = require.resolve('../routes/admin');
    delete require.cache[adminRoutePath];
    const adminRouter = require('../routes/admin');
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    return app;
  }

  beforeEach(() => {
    process.env.DC1_ADMIN_TOKEN = ADMIN_TOKEN;
    global.__testDb = new Database(':memory:');
  });

  afterEach(() => {
    delete process.env.DC1_ADMIN_TOKEN;
    try {
      global.__testDb.close();
    } catch {}
  });

  test('GET /notifications/config requires admin authentication', async () => {
    const app = buildAdminApp();
    const res = await request(app).get('/api/admin/notifications/config');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Admin access denied' });
  });

  test('GET /notifications/config returns masked token fields by default', async () => {
    const app = buildAdminApp();
    const res = await request(app)
      .get('/api/admin/notifications/config')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      enabled: false,
      webhook_url: '',
      telegram_configured: false,
      telegram_chat_id: '',
    });
    expect(res.body.telegram_bot_token).toBeUndefined();
    expect(res.body).toHaveProperty('updated_at');
  });

  test('POST /notifications/config updates config and GET reflects non-secret projection', async () => {
    const app = buildAdminApp();
    const updatePayload = {
      webhook_url: 'https://hooks.example.internal/dcp',
      telegram_bot_token: '123456:ABC-DEF',
      telegram_chat_id: '@dcp_ops',
      enabled: true,
    };

    const postRes = await request(app)
      .post('/api/admin/notifications/config')
      .set('x-admin-token', ADMIN_TOKEN)
      .send(updatePayload);

    expect(postRes.status).toBe(200);
    expect(postRes.body).toMatchObject({ success: true, message: 'Notification config updated' });

    const getRes = await request(app)
      .get('/api/admin/notifications/config')
      .set('x-admin-token', ADMIN_TOKEN);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({
      enabled: true,
      webhook_url: updatePayload.webhook_url,
      telegram_configured: true,
      telegram_chat_id: updatePayload.telegram_chat_id,
    });
    expect(getRes.body.telegram_bot_token).toBeUndefined();
  });
});
