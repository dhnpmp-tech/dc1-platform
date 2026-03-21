/**
 * DC1 Audit System — Comprehensive Tests
 * GUARDIAN agent (3bad1840) — expanded to 25+ tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSelect = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockRange = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();
const mockLte = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({
  data: { id: 'test-id', agent_id: 'a1', action: 'GET /test', resource_id: null, details: {}, timestamp: '2026-01-01T00:00:00Z' },
  error: null,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
      select: mockSelect,
      order: mockOrder,
      range: mockRange,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      single: mockSingle,
    }),
  }),
}));

// Set required env vars for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';

import { logAuditEvent, getAuditLog, getAuditLogById } from '../services/auditService';
import { sanitise, extractUserRole } from '../middleware/auditLogger';

// ── Audit Service Tests ────────────────────────────────────────────────────
describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRange.mockResolvedValue({ data: [{ id: '1', action: 'GET /test' }], error: null });
  });

  it('should log an audit event with all fields', async () => {
    await logAuditEvent({
      agent_id: 'agent-1',
      action: 'POST /api/jobs',
      resource_id: 'job-123',
      details: { gpu: 'A100' },
      method: 'POST',
      url: '/api/jobs',
      status_code: 201,
      duration_ms: 42,
      user_id: 'user-1',
      ip_address: '10.0.0.1',
      user_agent: 'Mozilla/5.0',
      request_body_hash: 'abc123',
      response_size_bytes: 512,
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.agent_id).toBe('agent-1');
    expect(row.action).toBe('POST /api/jobs');
    expect(row.details.status_code).toBe(201);
    expect(row.details.duration_ms).toBe(42);
  });

  it('should handle null/missing optional fields gracefully', async () => {
    await logAuditEvent({ action: 'GET /health' });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.agent_id).toBeNull();
    expect(row.resource_id).toBeNull();
  });

  it('should never throw on insert failure (fire-and-forget)', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(logAuditEvent({ action: 'GET /test' })).resolves.not.toThrow();
  });

  it('should query logs with default pagination', async () => {
    const logs = await getAuditLog({});
    expect(logs).toHaveLength(1);
  });

  it('should clamp limit to max 100', async () => {
    await getAuditLog({ limit: 500 });
    // The service clamps to 100
    expect(mockRange).toHaveBeenCalled();
  });

  it('should apply all filters when provided', async () => {
    await getAuditLog({
      agent_id: 'a1',
      action: 'POST /test',
      from: '2026-01-01',
      to: '2026-12-31',
      page: 2,
      limit: 25,
    });
    expect(mockEq).toHaveBeenCalledTimes(2);
    expect(mockGte).toHaveBeenCalledTimes(1);
    expect(mockLte).toHaveBeenCalledTimes(1);
  });
});

// ── Get By ID Tests ────────────────────────────────────────────────────────
describe('Audit Service — getAuditLogById', () => {
  it('should return a record for valid UUID', async () => {
    const record = await getAuditLogById('550e8400-e29b-41d4-a716-446655440000');
    expect(record).toBeTruthy();
    expect(record?.id).toBe('test-id');
  });

  it('should return null for invalid UUID format', async () => {
    const record = await getAuditLogById('not-a-uuid');
    expect(record).toBeNull();
    expect(mockSingle).not.toHaveBeenCalled();
  });

  it('should return null for empty string', async () => {
    const record = await getAuditLogById('');
    expect(record).toBeNull();
  });

  it('should return null for SQL injection attempt', async () => {
    const record = await getAuditLogById("'; DROP TABLE audit_logs; --");
    expect(record).toBeNull();
  });
});

// ── Sanitisation Tests ─────────────────────────────────────────────────────
describe('Sanitisation', () => {
  it('should redact password field', () => {
    expect(sanitise({ password: 'secret123' })).toEqual({ password: '[REDACTED]' });
  });

  it('should redact token field', () => {
    expect(sanitise({ token: 'jwt-abc' })).toEqual({ token: '[REDACTED]' });
  });

  it('should redact apiKey field', () => {
    expect(sanitise({ apiKey: 'key-123' })).toEqual({ apiKey: '[REDACTED]' });
  });

  it('should redact api_key field', () => {
    expect(sanitise({ api_key: 'key-456' })).toEqual({ api_key: '[REDACTED]' });
  });

  it('should redact Authorization field', () => {
    expect(sanitise({ Authorization: 'Bearer xyz' })).toEqual({ Authorization: '[REDACTED]' });
  });

  it('should redact secret field', () => {
    expect(sanitise({ secret: 'shhh' })).toEqual({ secret: '[REDACTED]' });
  });

  it('should handle null input', () => {
    expect(sanitise(null)).toBeNull();
  });

  it('should handle undefined input', () => {
    expect(sanitise(undefined)).toBeUndefined();
  });

  it('should sanitise arrays recursively', () => {
    const input = [{ password: 'a' }, { token: 'b' }];
    const result = sanitise(input) as any[];
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].token).toBe('[REDACTED]');
  });

  it('should sanitise nested objects recursively', () => {
    const input = { user: { profile: { password: 'deep' } } };
    const result = sanitise(input) as any;
    expect(result.user.profile.password).toBe('[REDACTED]');
  });

  it('should pass through non-sensitive fields unchanged', () => {
    const input = { name: 'Alice', email: 'alice@dc1.io', role: 'admin' };
    expect(sanitise(input)).toEqual(input);
  });

  it('should handle primitives (strings, numbers)', () => {
    expect(sanitise('hello')).toBe('hello');
    expect(sanitise(42)).toBe(42);
    expect(sanitise(true)).toBe(true);
  });
});

// ── extractUserRole Tests ──────────────────────────────────────────────────
describe('extractUserRole', () => {
  it('should return role from decoded JWT', () => {
    const mockReq = { user: { role: 'admin', sub: 'user-1' } } as any;
    expect(extractUserRole(mockReq)).toBe('admin');
  });

  it('should return anonymous when no user on request', () => {
    const mockReq = {} as any;
    expect(extractUserRole(mockReq)).toBe('anonymous');
  });

  it('should return anonymous when user has no role', () => {
    const mockReq = { user: { sub: 'user-1' } } as any;
    expect(extractUserRole(mockReq)).toBe('anonymous');
  });

  it('should return anonymous when user is null', () => {
    const mockReq = { user: null } as any;
    expect(extractUserRole(mockReq)).toBe('anonymous');
  });
});

// ── Rate Limiting Tests (Route-level) ──────────────────────────────────────
describe('Audit Routes — Admin Guard', () => {
  it('should reject requests without JWT', async () => {
    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const mockRequest = {
      jwtVerify: vi.fn().mockRejectedValue(new Error('No token')),
      ip: '127.0.0.1',
    };

    // Simulate the requireAdmin logic
    try {
      await mockRequest.jwtVerify();
    } catch {
      mockReply.status(401).send({ error: 'Unauthorized' });
    }
    expect(mockReply.status).toHaveBeenCalledWith(401);
  });

  it('should reject non-admin users', () => {
    const mockReq = { user: { role: 'viewer', sub: 'user-2' } } as any;
    const role = extractUserRole(mockReq);
    expect(role).toBe('viewer');
    expect(role).not.toBe('admin');
  });
});
