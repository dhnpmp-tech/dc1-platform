import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'https://api.dcp.sa';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ status: 'error' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 502 });
  }
}
