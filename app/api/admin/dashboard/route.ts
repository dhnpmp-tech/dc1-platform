import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';

async function safeFetch(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const [dashboard, fleet, reconciliation, activeJobsRaw] = await Promise.all([
    safeFetch(`${BACKEND_URL}/api/admin/dashboard`),
    safeFetch(`${BACKEND_URL}/api/intelligence/fleet`),
    safeFetch(`${BACKEND_URL}/api/reconciliation/summary`),
    safeFetch(`${BACKEND_URL}/api/jobs/active`),
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
