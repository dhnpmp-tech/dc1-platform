/**
 * DC1 Backend — Fastify Server Entry Point
 * Gate 0 — includes audit logging middleware.
 */

import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import auditLogger from './middleware/auditLogger';
import auditRoutes from './routes/audit';
import billingRoutes from './routes/billing';
import jobRoutes from './routes/jobs';

const app = Fastify({ logger: true });

// ── Plugins ──────────────────────────────────────────────────────────────────

// JWT authentication
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'dc1-dev-secret',
});

// Audit logging middleware (must be registered before routes)
app.register(auditLogger);

// ── Routes ───────────────────────────────────────────────────────────────────

app.register(auditRoutes, { prefix: '/api/v1/audit' });
app.register(billingRoutes);
app.register(jobRoutes);

// Health check (excluded from audit logs)
app.get('/health', async () => ({ status: 'ok' }));
app.get('/ping', async () => 'pong');

// ── Start ────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`DC1 backend listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;
