/**
 * DC1 Integration Test Setup
 * Helpers for creating test data with unique prefixes.
 * All external services (Supabase, Docker, MC API) are mocked.
 */

import { vi } from 'vitest';
import crypto from 'crypto';

// ── Test Run Prefix ──────────────────────────────────────────────────────────
const TEST_RUN_ID = `test_sync_${crypto.randomUUID().slice(0, 8)}`;
let counter = 0;

export function testId(prefix = 'id'): string {
  return `${TEST_RUN_ID}_${prefix}_${++counter}`;
}

export function testRunId(): string {
  return TEST_RUN_ID;
}

// ── Mock fetch for Mission Control API ───────────────────────────────────────
const mcHandlers: Map<
  string,
  (url: string, init?: RequestInit) => { ok: boolean; status: number; json: () => Promise<unknown> }
> = new Map();

function clearMcEndpoints(): void {
  mcHandlers.clear();
}

// ── Billing Utility Functions (shared across test files) ─────────────────────
/** Calculate cost in halala for a given number of minutes at a given hourly rate */
export function costForMinutes(minutes: number, ratePerHourHalala: number): number {
  return Math.round((minutes * ratePerHourHalala) / 60);
}

/** Split a total halala amount into provider (75%) and DC1 (25%) shares */
export function splitCost(total: number): { provider: number; dc1: number } {
  const provider = Math.round((total * 75) / 100);
  const dc1 = total - provider;
  return { provider, dc1 };
}

// ── Test Data Factories ──────────────────────────────────────────────────────
export function createTestWallet(userId?: string, balanceHalala = 100_000) {
  return {
    userId: userId ?? testId('user'),
    total: balanceHalala,
    reserved: 0,
    available: balanceHalala,
  };
}

export function createTestGPU(
  overrides: Partial<{
    id: string;
    providerId: string;
    gpuModel: string;
    vramGb: number;
    ratePerHour: number;
    reliability: number;
    status: 'available' | 'in-use' | 'maintenance';
  }> = {},
) {
  return {
    id: overrides.id ?? testId('gpu'),
    providerId: overrides.providerId ?? testId('provider'),
    gpuModel: overrides.gpuModel ?? 'NVIDIA A100',
    vramGb: overrides.vramGb ?? 80,
    ratePerHour: overrides.ratePerHour ?? 2.5,
    reliability: overrides.reliability ?? 0.99,
    status: (overrides.status ?? 'available') as const,
  };
}

export function createTestJob(
  overrides: Partial<{
    renterId: string;
    dockerImage: string;
    jobCodePath: string;
    requiredVramGb: number;
    estimatedHours: number;
    maxBudgetUsd: number;
    gpuCount: number;
    metadata: Record<string, string>;
  }> = {},
) {
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

export function createTestBillingSession(
  overrides: Partial<{
    id: string;
    jobId: string;
    renterId: string;
    providerId: string;
    ratePerHourHalala: number;
    startedAt: Date;
    status: 'active' | 'closing' | 'closed';
  }> = {},
) {
  return {
    id: overrides.id ?? testId('session'),
    jobId: overrides.jobId ?? testId('job'),
    renterId: overrides.renterId ?? testId('renter'),
    providerId: overrides.providerId ?? testId('provider'),
    ratePerHourHalala: overrides.ratePerHourHalala ?? 250,
    startedAt: overrides.startedAt ?? new Date(),
    reservationId: testId('reservation'),
    reservedAmountHalala: (overrides.ratePerHourHalala ?? 250) * 24,
    status: (overrides.status ?? 'active') as const,
  };
}

export function cleanupTestData(): void {
  clearMcEndpoints();
  counter = 0;
}
