export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';

function requireAdminCallerAuth(request: NextRequest): NextResponse | null {
  const callerToken = request.headers.get('x-admin-token');
  const serverToken = process.env.DC1_ADMIN_TOKEN;

  if (!serverToken) {
    return NextResponse.json({ error: 'Admin auth misconfigured' }, { status: 500 });
  }

  if (!callerToken || callerToken !== serverToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function adminHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {};
  const serverToken = process.env.DC1_ADMIN_TOKEN;
  if (serverToken) headers['x-admin-token'] = serverToken;
  const clientToken = request.headers.get('x-admin-token');
  if (clientToken && !serverToken) headers['x-admin-token'] = clientToken;
  return headers;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireAdminCallerAuth(request);
  if (authError) return authError;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/jobs/${params.id}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: adminHeaders(request),
    });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: res.status });
    }
    if (!res.ok) return NextResponse.json({ error: 'Backend error' }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
