/**
 * DC1 Audit Routes — Gate 0
 * Admin-only endpoints for querying immutable audit logs.
 * GUARDIAN agent (3bad1840) — hardened with rate limiting
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAuditLog, getAuditLogById, type AuditFilters } from '../services/auditService';
import { extractUserRole } from '../middleware/auditLogger';

// ── Rate Limiting ──────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.AUDIT_RATE_LIMIT ?? '30', 10);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60_000);

// ── Auth Guard ─────────────────────────────────────────────────────────────
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Rate limit check first
  if (!checkRateLimit(request.ip)) {
    return reply.status(429).send({ error: 'Too many requests. Try again later.' });
  }

  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const role = extractUserRole(request);
  if (role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden: admin role required' });
  }
}

// ── Route Definitions ──────────────────────────────────────────────────────
interface AuditLogQuery {
  agent_id?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

export default async function auditRoutes(app: FastifyInstance): Promise<void> {
  // Apply admin guard to all routes in this plugin
  app.addHook('onRequest', requireAdmin);

  // GET /audit/logs — paginated, filterable
  app.get(
    '/audit/logs',
    async (
      request: FastifyRequest<{ Querystring: AuditLogQuery }>,
      reply: FastifyReply,
    ) => {
      const q = request.query;

      const filters: AuditFilters = {
        agent_id: q.agent_id,
        action: q.action,
        from: q.from,
        to: q.to,
        page: q.page ? parseInt(q.page, 10) : 1,
        limit: q.limit ? Math.min(parseInt(q.limit, 10), 100) : 50,
      };

      // Validate page/limit are positive integers
      if (filters.page! < 1 || !Number.isFinite(filters.page!)) {
        return reply.status(400).send({ error: 'Invalid page parameter' });
      }
      if (filters.limit! < 1 || !Number.isFinite(filters.limit!)) {
        return reply.status(400).send({ error: 'Invalid limit parameter' });
      }

      try {
        const logs = await getAuditLog(filters);
        return reply.send({ data: logs, page: filters.page, limit: filters.limit });
      } catch (err: unknown) {
        return reply.status(500).send({ error: 'Failed to query audit logs' });
      }
    },
  );

  // GET /audit/logs/:id — single record
  app.get(
    '/audit/logs/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const record = await getAuditLogById(request.params.id);
        if (!record) return reply.status(404).send({ error: 'Audit record not found' });
        return reply.send({ data: record });
      } catch (err: unknown) {
        return reply.status(500).send({ error: 'Failed to fetch audit record' });
      }
    },
  );
}
