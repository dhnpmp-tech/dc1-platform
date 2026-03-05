import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

interface SubmitBody {
  renterId?: string;
  dockerImage: string;
  jobCodePath?: string;
  requiredVramGb: number;
  gpuCount: number;
  estimatedHours: number;
  maxBudgetUsd?: number;
  metadata?: Record<string, unknown>;
}

interface Provider {
  id: number;
  name: string;
  status: string;
  gpu_model: string;
  vram_gib: number;
}

export async function POST(request: Request) {
  try {
    const body: SubmitBody = await request.json();

    if (!body.dockerImage || !body.requiredVramGb || !body.estimatedHours) {
      return NextResponse.json(
        { error: 'Missing required fields: dockerImage, requiredVramGb, estimatedHours' },
        { status: 400 }
      );
    }

    // Fetch providers from intelligence endpoint
    const providersRes = await fetch(`${BACKEND}/api/intelligence/providers`);
    if (!providersRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch providers' },
        { status: 502 }
      );
    }

    const providers: Provider[] = await providersRes.json();

    // Filter online providers with sufficient VRAM
    const requiredVramGib = body.requiredVramGb;
    const eligible = providers.filter(
      (p) =>
        (p.status === 'online' || p.status === 'connected') &&
        (p.vram_gib >= requiredVramGib || p.vram_gib === 0) // vram_gib=0 means unknown, allow for Gate 0
    );

    if (eligible.length === 0) {
      // Gate 0 fallback: if no online providers, pick first registered one with matching GPU
      const fallback = providers.find((p) => p.status !== 'offline');
      if (!fallback) {
        return NextResponse.json(
          { error: 'No available providers matching requirements. All providers are offline.' },
          { status: 503 }
        );
      }
      // Use fallback for Gate 0 testing
      eligible.push(fallback as Provider & { status: string });
    }

    // Select first eligible provider (Gate 0 — simple selection)
    const selectedProvider = eligible[0];
    const durationMinutes = Math.round(body.estimatedHours * 60);

    // Submit to backend
    const submitRes = await fetch(`${BACKEND}/api/jobs/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id: selectedProvider.id,
        job_type: 'gpu-compute',
        duration_minutes: durationMinutes,
        gpu_requirements: {
          min_vram_gb: body.requiredVramGb,
          docker_image: body.dockerImage,
          gpu_count: body.gpuCount || 1,
          job_code_path: body.jobCodePath || '',
        },
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({ error: 'Backend submission failed' }));
      return NextResponse.json(
        { error: err.error || 'Job submission failed', details: err },
        { status: submitRes.status }
      );
    }

    const result = await submitRes.json();

    return NextResponse.json({
      success: true,
      job: {
        id: result.job?.id,
        status: result.job?.status,
        providerId: selectedProvider.id,
        providerName: selectedProvider.name,
        gpuModel: selectedProvider.gpu_model,
        submittedAt: result.job?.submitted_at,
        durationMinutes: result.job?.duration_minutes,
        costHalala: result.job?.cost_halala,
      },
    });
  } catch (error) {
    console.error('Job submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error during job submission' },
      { status: 500 }
    );
  }
}
