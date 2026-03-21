export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'https://api.dcp.sa';

/** Proxy to backend Windows .exe installer (no API key — user enters key during install). */
export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/providers/download-windows-exe`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || 'Installer not available', ...err },
        { status: res.status }
      );
    }
    const body = res.body;
    if (body == null) {
      return NextResponse.json(
        { error: 'Installer stream empty', message: 'Backend returned no body' },
        { status: 502 }
      );
    }
    const headers = new Headers();
    const cd = res.headers.get('content-disposition');
    if (cd) headers.set('content-disposition', cd);
    const ct = res.headers.get('content-type');
    if (ct) headers.set('content-type', ct);
    return new NextResponse(body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
