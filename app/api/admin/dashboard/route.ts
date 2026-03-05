import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';

// Build headers for backend calls — forwards admin token when configured
function adminHeaders(): HeadersInit {
  const token = process.env.DC1_ADMIN_TOKEN;
  return token ? { 'x-admin-token': token } : {};
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
async function adminFetch(url: string) {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: adminHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const [dashboard, fleet, reconciliation, activeJobsRaw] = await Promise.all([
    adminFetch(`${BACKEND_URL}/api/admin/dashboard`),      // admin-gated
    safeFetch(`${BACKEND_URL}/api/intelligence/fleet`),    // open router
    safeFetch(`${BACKEND_URL}/api/reconciliation/summary`), // open router
    safeFetch(`${BACKEND_URL}/api/jobs/active`),           // open router
  ]);

  // /api/jobs/active returns { jobs: [...] } — unwrap to array
  const activeJobs = activeJobsRaw?.jobs ?? null;

  return NextResponse.json({
    dashboard,
    fleet,
    reconciliation,
    activeJobs,
    fetchedAt: new Date().toISOString(),
  });
}
