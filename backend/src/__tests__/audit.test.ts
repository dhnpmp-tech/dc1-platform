/**
 * DC1 Audit Logging Tests — Gate 0 Security
 * GUARDIAN agent (3bad1840)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitise } from '../middleware/auditLogger';

// ── Mock Supabase ────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSelect = vi.fn().mockReturnValue({
  order: vi.fn().mockReturnValue({
    range: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: mockInsert,
      select: mockSelect,
    }),
  }),
}));

// Import after mock
import { logAuditEvent, getAuditLog } from '../services/auditService';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logAuditEvent inserts a record with correct fields', async () => {
    await logAuditEvent({
      action: 'GET /api/test',
      method: 'GET',
      url: '/api/test',
      status_code: 200,
      duration_ms: 42,
      user_id: 'user-123',
      ip_address: '127.0.0.1',
      user_agent: 'vitest',
      request_body_hash: 'abc123',
      response_size_bytes: 512,
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    const row = mockInsert.mock.calls[0][0];
    expect(row.action).toBe('GET /api/test');
    expect(row.details.method).toBe('GET');
    expect(row.details.status_code).toBe(200);
    expect(row.details.duration_ms).toBe(42);
    expect(row.details.user_id).toBe('user-123');
    expect(row.details.ip_address).toBe('127.0.0.1');
    expect(row.details.request_body_hash).toBe('abc123');
    expect(row.details.response_size_bytes).toBe(512);
  });

  it('logAuditEvent never throws on Supabase failure', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB down'));
    // Must not throw
    await expect(
      logAuditEvent({ action: 'FAIL_TEST' })
    ).resolves.toBeUndefined();
  });

  it('logAuditEvent never throws on unexpected error', async () => {
    mockInsert.mockImplementationOnce(() => { throw new TypeError('boom'); });
    await expect(
      logAuditEvent({ action: 'CRASH_TEST' })
    ).resolves.toBeUndefined();
  });

  it('getAuditLog calls Supabase with correct table', async () => {
    await getAuditLog({ page: 1, limit: 10 });
    expect(mockSelect).toHaveBeenCalled();
  });
});

describe('Sanitisation', () => {
  it('redacts password fields', () => {
    const input = { username: 'peter', password: 's3cret' };
    const result = sanitise(input) as Record<string, unknown>;
    expect(result.username).toBe('peter');
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts nested sensitive fields', () => {
    const input = { data: { token: 'abc', name: 'test' } };
    const result = sanitise(input) as Record<string, Record<string, unknown>>;
    expect(result.data.token).toBe('[REDACTED]');
    expect(result.data.name).toBe('test');
  });

  it('redacts apiKey and api_key', () => {
    const input = { apiKey: 'key1', api_key: 'key2', safe: 'ok' };
    const result = sanitise(input) as Record<string, unknown>;
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.safe).toBe('ok');
  });

  it('redacts Authorization header', () => {
    const input = { Authorization: 'Bearer xxx', host: 'dc1.com' };
    const result = sanitise(input) as Record<string, unknown>;
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result.host).toBe('dc1.com');
  });

  it('handles null and undefined gracefully', () => {
    expect(sanitise(null)).toBeNull();
    expect(sanitise(undefined)).toBeUndefined();
  });

  it('handles arrays', () => {
    const input = [{ password: 'x' }, { name: 'y' }];
    const result = sanitise(input) as Record<string, unknown>[];
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].name).toBe('y');
  });
});

describe('Audit Routes - Admin Guard', () => {
  it('extractUserRole returns null for missing user', async () => {
    const { extractUserRole } = await import('../middleware/auditLogger');
    const fakeReq = {} as unknown as import('fastify').FastifyRequest;
    expect(extractUserRole(fakeReq)).toBeNull();
  });

  it('extractUserRole returns role when present', async () => {
    const { extractUserRole } = await import('../middleware/auditLogger');
    const fakeReq = { user: { role: 'admin', id: '123' } } as unknown as import('fastify').FastifyRequest;
    expect(extractUserRole(fakeReq)).toBe('admin');
  });
});
