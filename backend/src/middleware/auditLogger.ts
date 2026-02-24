/**
 * DC1 Audit Logger Middleware — Fastify Plugin
 * Immutable, non-blocking request/response audit logging.
 * GUARDIAN agent (3bad1840) — Gate 0 Security Requirement
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { logAuditEvent } from '../services/auditService';

// ── Configuration ────────────────────────────────────────────────────────────

const EXCLUDED_ROUTES = new Set(['/health', '/ping']);

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'apiKey', 'api_key', 'secret', 'Authorization',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * SHA-256 hash of request body (never log raw body).
 */
function hashBody(body: unknown): string | null {
  if (!body) return null;
  try {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    return createHash('sha256').update(raw).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Deep-sanitise an object, replacing sensitive values with '[REDACTED]'.
 */
export function sanitise(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitise);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      out[key] = sanitise(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Extract user_id from JWT payload attached by Fastify JWT plugin.
 */
function extractUserId(request: FastifyRequest): string | null {
  try {
    const user = (request as unknown as Record<string, unknown>).user as
      | Record<string, unknown>
      | undefined;
    return (user?.id as string) ?? (user?.sub as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract user role from JWT payload.
 */
export function extractUserRole(request: FastifyRequest): string | null {
  try {
    const user = (request as unknown as Record<string, unknown>).user as
      | Record<string, unknown>
      | undefined;
    return (user?.role as string) ?? null;
  } catch {
    return null;
  }
}

// ── Plugin ───────────────────────────────────────────────────────────────────

async function auditLoggerPlugin(fastify: FastifyInstance): Promise<void> {
  // Mark request start time
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    (request as unknown as Record<string, unknown>).__auditStart = Date.now();
  });

  // Log on response (fire-and-forget)
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Skip excluded routes
      if (EXCLUDED_ROUTES.has(request.url)) return;

      const startTime = (request as unknown as Record<string, unknown>).__auditStart as number | undefined;
      const durationMs = startTime ? Date.now() - startTime : null;

      const sanitisedBody = request.body ? sanitise(request.body) : null;

      // Fire-and-forget — do not await in production-critical path
      logAuditEvent({
        action: `${request.method} ${request.url}`,
        user_id: extractUserId(request),
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
        duration_ms: durationMs ?? undefined,
        ip_address: request.ip,
        user_agent: request.headers['user-agent'] ?? null,
        request_body_hash: hashBody(sanitisedBody),
        response_size_bytes: Number(reply.getHeader('content-length')) || null,
        details: sanitisedBody as Record<string, unknown> | null,
      }).catch(() => {
        // Swallowed — audit must never impact the API
      });
    } catch {
      // Outer catch — absolutely bulletproof
    }
  });
}

export default fp(auditLoggerPlugin, {
  name: 'dc1-audit-logger',
  fastify: '4.x',
});
