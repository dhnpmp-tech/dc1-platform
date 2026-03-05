import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = {
      name: body.name,
      email: body.email,
      gpu_model: 'unknown',
      os: 'Windows',
      run_mode: body.run_mode,
      scheduled_start: body.scheduled_start,
      scheduled_end: body.scheduled_end,
    };
    const res = await fetch(`${BACKEND}/api/providers/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    // Mock fallback
    return NextResponse.json({ api_key: 'dc1-provider-demo-' + Date.now(), provider_id: 999 });
  } catch {
    return NextResponse.json({ api_key: 'dc1-provider-demo-' + Date.now(), provider_id: 999 });
  }
}
