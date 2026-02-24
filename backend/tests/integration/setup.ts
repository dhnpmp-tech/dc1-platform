/**
 * DC1 Integration Test Setup
 * Helpers for creating test data with unique prefixes.
 * All external services (Supabase, Docker, MC API) are mocked.
 */

import { vi } from 'vitest';
import crypto from 'crypto';

// ── Test Run Prefix ────────────────────────────────────────────────────────

const TEST_RUN_ID = `test_sync_${crypto.randomUUID().slice(0, 8)}`;
let counter = 0;

export function testId(prefix = 'id'): string {
  return `${TEST_RUN_ID}_${prefix}_${++counter}`;
}

export function testRunId(): string {
  return TEST_RUN_ID;
}

// ── Supabase Mock ──────────────────────────────────────────────────────────

export interface MockSupabaseChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

/** In-memory store keyed by table name, for simple mock persistence */
const mockStore: Record<string, Record<string, unknown>[]> = {};

export function getMockStore(table: string): Record<string, unknown>[] {
  if (!mockStore[table]) mockStore[table] = [];
  return mockStore[table]!;
}

export function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

function buildChain(resolveData: unknown = null, resolveError: unknown = null): MockSupabaseChain {
  const result = { data: resolveData, error: resolveError };
  const chain = {} as MockSupabaseChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  (chain as any).then = (resolve: (v: any) => void) => resolve(result);
  return chain;
}

export function createMockSupabase() {
  const rpcFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const fromFn = vi.fn().mockReturnValue(buildChain());

  return {
    from: fromFn,
    rpc: rpcFn,
    _buildChain: buildChain,
  };
}

export const mockSupabase = createMockSupabase();

// ── Mock fetch for Mission Control API ─────────────────────────────────────

export interface MockMcResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const mcHandlers: Map<string, (url: string, init?: RequestInit) => MockMcResponse> = new Map();

export function mockMcEndpoint(
  method: string,
  pathPattern: string,
  handler: (url: string, body?: unknown) => { status: number; data: unknown },
): void {
  const key = `${method.toUpperCase()}:${pathPattern}`;
  mcHandlers.set(key, (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const result = handler(url, body);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.data,
    };
  });
}

export function clearMcEndpoints(): void {
  mcHandlers.clear();
}

export function createMockFetch() {
  return vi.fn(async (url: string | URL, init?: RequestInit): Promise<MockMcResponse> => {
    const urlStr = url.toString();
    const method = (init?.method ?? 'GET').toUpperCase();

    // Try exact match first, then pattern match
    for (const [key, handler] of mcHandlers) {
      const [m, pattern] = key.split(':');
      if (m === method && urlStr.includes(pattern!)) {
        return handler(urlStr, init);
      }
    }

    // Default: audit endpoint always succeeds
    if (urlStr.includes('/security/audit')) {
      return { ok: true, status: 200, json: async () => ({}) };
    }

    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
  });
}

// ── Test Data Factories ────────────────────────────────────────────────────

export function createTestWallet(userId?: string, balanceHalala = 100_000) {
  return {
    userId: userId ?? testId('user'),
    total: balanceHalala,
    reserved: 0,
    available: balanceHalala,
  };
}

export function createTestGPU(overrides: Partial<{
  id: string;
  providerId: string;
  gpuModel: string;
  vramGb: number;
  ratePerHour: number;
  reliability: number;
  status: 'available' | 'in-use' | 'maintenance';
}> = {}) {
  return {
    id: overrides.id ?? testId('gpu'),
    providerId: overrides.providerId ?? testId('provider'),
    gpuModel: overrides.gpuModel ?? 'NVIDIA A100',
    vramGb: overrides.vramGb ?? 80,
    ratePerHour: overrides.ratePerHour ?? 2.50,
    reliability: overrides.reliability ?? 0.99,
    status: overrides.status ?? 'available' as const,
  };
}

export function createTestJob(overrides: Partial<{
  renterId: string;
  dockerImage: string;
  jobCodePath: string;
  requiredVramGb: number;
  estimatedHours: number;
  maxBudgetUsd: number;
  gpuCount: number;
  metadata: Record<string, string>;
}> = {}) {
  return {
    renterId: overrides.renterId ?? testId('renter'),
    dockerImage: overrides.dockerImage ?? 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
    jobCodePath: overrides.jobCodePath ?? '/tmp/test-job-code',
    requiredVramGb: overrides.requiredVramGb ?? 24,
    estimatedHours: overrides.estimatedHours ?? 2,
    maxBudgetUsd: overrides.maxBudgetUsd ?? 10,
    gpuCount: overrides.gpuCount ?? 1,
    metadata: overrides.metadata ?? { env: 'test' },
  };
}

export function createTestBillingSession(overrides: Partial<{
  id: string;
  jobId: string;
  renterId: string;
  providerId: string;
  ratePerHourHalala: number;
  startedAt: Date;
  status: 'active' | 'closing' | 'closed';
}> = {}) {
  return {
    id: overrides.id ?? testId('session'),
    jobId: overrides.jobId ?? testId('job'),
    renterId: overrides.renterId ?? testId('renter'),
    providerId: overrides.providerId ?? testId('provider'),
    ratePerHourHalala: overrides.ratePerHourHalala ?? 250,
    startedAt: overrides.startedAt ?? new Date(),
    reservationId: testId('reservation'),
    reservedAmountHalala: (overrides.ratePerHourHalala ?? 250) * 24,
    status: overrides.status ?? 'active' as const,
  };
}

export function cleanupTestData(): void {
  clearMockStore();
  clearMcEndpoints();
  counter = 0;
}
