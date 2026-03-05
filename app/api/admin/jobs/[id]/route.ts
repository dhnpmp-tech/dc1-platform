import { NextRequest, NextResponse } from 'next/server';
const BACKEND_URL = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/jobs/${params.id}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return NextResponse.json({ error: 'Backend error' }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
