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

// ── Startup Validation ─────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    console.error('Server cannot start without these values. Exiting.');
    process.exit(1);
  }
}

validateEnv();

const app = Fastify({ logger: true });

// ── Plugins ────────────────────────────────────────────────────────────────
// JWT authentication — hard fail if JWT_SECRET missing (validated above)
// F1 fix: pin algorithm to HS256 to prevent alg:none / algorithm confusion attacks
// F2 fix: enforce 24h expiry so stolen tokens cannot be used indefinitely
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  sign: { expiresIn: '24h' },
  verify: { algorithms: ['HS256'] },
});

// Audit logging middleware (must be registered before routes)
app.register(auditLogger);

// ── Routes ─────────────────────────────────────────────────────────────────
app.register(auditRoutes, { prefix: '/api/v1/audit' });
app.register(billingRoutes);
app.register(jobRoutes);

// Health check (excluded from audit logs)
app.get('/health', async () => ({ status: 'ok' }));
app.get('/ping', async () => 'pong');

// ── Start ──────────────────────────────────────────────────────────────────
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
