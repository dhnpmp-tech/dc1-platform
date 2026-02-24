/**
 * DC1 Audit Logger Middleware — Gate 0 Security
 * Fire-and-forget request/response audit logging.
 * GUARDIAN agent (3bad1840) — hardened
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'crypto';
import { logAuditEvent } from '../services/auditService';

// ── Configurable Excluded Routes ───────────────────────────────────────────
function getExcludedRoutes(): Set<string> {
  const envRoutes = process.env.AUDIT_EXCLUDED_ROUTES;
  if (envRoutes) {
    return new Set(envRoutes.split(',').map((r) => r.trim()).filter(Boolean));
  }
  return new Set(['/health', '/ping']);
}

const EXCLUDED_ROUTES = getExcludedRoutes();

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'Authorization',
]);

// ── Helpers ────────────────────────────────────────────────────────────────
function hashBody(body: unknown): string | null {
  if (!body) return null;
  try {
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    return createHash('sha256').update(str).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Recursively sanitise sensitive fields from an object.
 * Returns a new object — never mutates the original.
 */
export function sanitise(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitise);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitise(value);
    }
    return out;
  }
  return obj;
}

/**
 * Extract user role from a decoded JWT on the request.
 */
export function extractUserRole(request: FastifyRequest): string {
  try {
    const user = (request as any).user;
    return user?.role ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// ── Plugin ─────────────────────────────────────────────────────────────────
async function auditLoggerPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any)._auditStart = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Skip excluded routes
      if (EXCLUDED_ROUTES.has(request.url)) return;

      const duration = Date.now() - ((request as any)._auditStart ?? Date.now());
      const role = extractUserRole(request);

      // Fire-and-forget — never await in production hot path
      logAuditEvent({
        agent_id: (request.headers['x-agent-id'] as string) ?? null,
        action: `${request.method} ${request.url}`,
        resource_id: (request.params as any)?.id ?? null,
        details: sanitise(request.query) as Record<string, unknown>,
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
        duration_ms: duration,
        user_id: ((request as any).user?.sub as string) ?? null,
        ip_address: request.ip,
        user_agent: request.headers['user-agent'] ?? null,
        request_body_hash: hashBody(request.body),
        response_size_bytes: parseInt(reply.getHeader('content-length') as string, 10) || null,
      }).catch(() => {
        /* swallow — audit must never crash the API */
      });
    } catch {
      /* swallow — audit must never crash the API */
    }
  });
}

export default fp(auditLoggerPlugin, {
  name: 'audit-logger',
  fastify: '4.x',
});
