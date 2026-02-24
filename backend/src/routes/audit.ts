/**
 * DC1 Audit Routes — Gate 0
 * Admin-only endpoints for querying immutable audit logs.
 * GUARDIAN agent (3bad1840)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAuditLog, getAuditLogById, type AuditFilters } from '../services/auditService';
import { extractUserRole } from '../middleware/auditLogger';

// ── Auth Guard ───────────────────────────────────────────────────────────────

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

// ── Route Definitions ────────────────────────────────────────────────────────

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
  app.get('/audit/logs', async (request: FastifyRequest<{ Querystring: AuditLogQuery }>, reply: FastifyReply) => {
    const q = request.query;
    const filters: AuditFilters = {
      agent_id: q.agent_id,
      action: q.action,
      from: q.from,
      to: q.to,
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? Math.min(parseInt(q.limit, 10), 100) : 50,
    };

    try {
      const logs = await getAuditLog(filters);
      return reply.send({ data: logs, page: filters.page, limit: filters.limit });
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Failed to query audit logs' });
    }
  });

  // GET /audit/logs/:id — single record
  app.get('/audit/logs/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const record = await getAuditLogById(request.params.id);
      if (!record) return reply.status(404).send({ error: 'Audit record not found' });
      return reply.send({ data: record });
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Failed to fetch audit record' });
    }
  });
}
