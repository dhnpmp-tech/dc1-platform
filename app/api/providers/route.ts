import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

// Known VRAM by GPU model (GiB) — used when backend reports 0
const KNOWN_VRAM: Record<string, number> = {
  'RTX 4090': 24,
  'RTX 3090': 24,
  'RTX 3080': 10,
  'RTX 3070': 8,
  'RTX 3060 Ti': 8,
  'RTX 3060': 12,
  'RTX 4060 Ti': 8,
  'NVIDIA GeForce RTX 4060': 8,
  'RTX 5070 Ti': 12,
  'RX 9070 XT': 16,
  'Apple M2': 8,
};

// Gate 0 flat rate (SAR/hr)
const DEFAULT_RATE_SAR = 15;

interface Provider {
  id: number;
  name: string;
  status: string;
  gpu_model: string;
  vram_gib: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minVram = Number(searchParams.get('minVram') || 0);

    const res = await fetch(`${BACKEND}/api/intelligence/providers`);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch providers from backend' },
        { status: 502 }
      );
    }

    const providers: Provider[] = await res.json();

    const mapped = providers
      .filter((p) => p.status === 'online' || p.status === 'connected' || p.status === 'registered')
      .map((p) => {
        const vramGb = p.vram_gib > 0 ? p.vram_gib : (KNOWN_VRAM[p.gpu_model] || 0);
        return {
          providerId: String(p.id),
          gpuModel: p.gpu_model,
          vramGb,
          ratePerHourSar: DEFAULT_RATE_SAR,
          available: p.status === 'online' || p.status === 'connected',
          status: p.status,
        };
      })
      .filter((p) => minVram === 0 || p.vramGb >= minVram);

    return NextResponse.json(
      { providers: mapped },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Providers API error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 502 }
    );
  }
}
