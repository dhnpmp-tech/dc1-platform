export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';

// Build headers for backend calls — forwards admin token from env + client
function adminHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {};
  // Server-side token (env var) — primary auth for server-to-backend
  const serverToken = process.env.DC1_ADMIN_TOKEN;
  if (serverToken) headers['x-admin-token'] = serverToken;
  // Client token — forwarded for validation transparency
  const clientToken = request.headers.get('x-admin-token');
  if (clientToken && !serverToken) headers['x-admin-token'] = clientToken;
  return headers;
}

// Generic fetch — no auth (intelligence / reconciliation / jobs are open routers)
async function safeFetch(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Admin-gated fetch — forwards DC1_ADMIN_TOKEN so token middleware passes
async function adminFetch(url: string, request: NextRequest) {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: adminHeaders(request),
    });
    if (!res.ok) return { __status: res.status, data: null };
    return { __status: 200, data: await res.json() };
  } catch {
    return { __status: 502, data: null };
  }
}

export async function GET(request: NextRequest) {
  const dashResult = await adminFetch(`${BACKEND_URL}/api/admin/dashboard`, request);

  // If admin endpoint returns 401, propagate it so the frontend can re-auth
  if (dashResult.__status === 401 || dashResult.__status === 403) {
    return NextResponse.json({ error: 'Admin access denied' }, { status: dashResult.__status });
  }

  const [fleet, reconciliation, activeJobsRaw] = await Promise.all([
    safeFetch(`${BACKEND_URL}/api/intelligence/fleet`),
    safeFetch(`${BACKEND_URL}/api/reconciliation/summary`),
    safeFetch(`${BACKEND_URL}/api/jobs/active`),
  ]);

  const activeJobs = activeJobsRaw?.jobs ?? null;

  return NextResponse.json({
    dashboard: dashResult.data,
    fleet,
    reconciliation,
    activeJobs,
    fetchedAt: new Date().toISOString(),
  });
}
