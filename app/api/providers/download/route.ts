import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const platform = req.nextUrl.searchParams.get('platform') || 'windows';
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  try {
    const res = await fetch(`${BACKEND}/api/providers/download?key=${key}&platform=${platform}`);
    if (!res.ok) {
      return NextResponse.json({ error: 'Download failed' }, { status: res.status });
    }
    const headers = new Headers();
    const cd = res.headers.get('content-disposition');
    if (cd) headers.set('content-disposition', cd);
    const ct = res.headers.get('content-type');
    if (ct) headers.set('content-type', ct);
    const body = res.body;
    return new NextResponse(body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
