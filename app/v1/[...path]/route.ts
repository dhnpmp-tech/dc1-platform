// Catch-all backend proxy for the /v1/* wizard + integration API.
//
// Mirror of app/api/[...path]/route.ts but for /v1 instead of /api.
// Hardcoded to https://api.dcp.sa because Vercel's BACKEND_URL env was
// rejected with DNS_HOSTNAME_RESOLVED_PRIVATE, making the next.config.js
// `/v1/:path*` rewrite 404 silently.
//
// Without this, https://dcp.sa/setup (provider wizard) returned 404 on
// POST /v1/provider/gpu-profile, blocking new provider onboarding.

import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'https://api.dcp.sa';

function buildBackendUrl(pathSegments: string[], search: string): string {
  const safePath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
  return `${BACKEND}/v1/${safePath}${search}`;
}

function copyRequestHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete('host');
  nextHeaders.delete('content-length');
  return nextHeaders;
}

async function proxyToBackend(req: NextRequest, path: string[]): Promise<NextResponse> {
  const targetUrl = buildBackendUrl(path, req.nextUrl.search);
  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.text();

  const backendRes = await fetch(targetUrl, {
    method,
    headers: copyRequestHeaders(req.headers),
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers(backendRes.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(await backendRes.arrayBuffer(), {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(req, path);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(req, path);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(req, path);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(req, path);
}
