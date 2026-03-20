export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'https://api.dcp.sa';

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/providers/me?key=${key}`);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ status: data.status || 'offline' });
    }
    return NextResponse.json({ status: 'offline' });
  } catch {
    return NextResponse.json({ status: 'offline' });
  }
}
