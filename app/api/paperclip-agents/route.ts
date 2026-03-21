export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  const apiKey = process.env.PAPERCLIP_API_KEY;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;

  if (!apiUrl || !apiKey || !companyId) {
    return NextResponse.json({ error: 'Paperclip not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${apiUrl}/api/companies/${companyId}/agents`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Paperclip API ${res.status}` }, { status: res.status });
    }
    const agents = await res.json();
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: 'Paperclip unreachable' }, { status: 502 });
  }
}
