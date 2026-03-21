export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

const BACKEND =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8083' : 'https://api.dcp.sa');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/api/providers/preferences`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
