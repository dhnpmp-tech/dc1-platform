import { NextResponse } from 'next/server';

interface PingResult {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs: number | null;
}

const SERVICE_URLS: Record<string, string> = {
  Vercel: 'https://dc1-platform.vercel.app',
  Supabase: 'https://fvvxqp-qqjszv6vweybvjfpc.supabase.co',
  'Mission Control': `http://76.13.179.86:8084/api/tasks`,
  'GitHub API': 'https://api.github.com',
};

export async function GET() {
  const MC_TOKEN = process.env.MC_API_TOKEN || '';

  const results: PingResult[] = await Promise.all(
    Object.entries(SERVICE_URLS).map(async ([name, url]) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const headers: Record<string, string> = {};
        if (name === 'Mission Control' && MC_TOKEN) {
          headers['Authorization'] = `Bearer ${MC_TOKEN}`;
        }
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers,
        });
        clearTimeout(timeout);
        const elapsed = Date.now() - start;
        const status: PingResult['status'] =
          res.ok ? (elapsed > 3000 ? 'degraded' : 'healthy') : 'down';
        return { name, status, responseTimeMs: elapsed };
      } catch {
        const elapsed = Date.now() - start;
        return { name, status: 'down' as const, responseTimeMs: elapsed > 10_000 ? null : elapsed };
      }
    }),
  );

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
