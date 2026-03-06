import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';

// New interface matching JobSubmitForm.tsx fields
interface SubmitBody {
  provider_id?: number | string;
  job_type: string;
  duration_minutes: number;
  gpu_requirements?: {
    min_vram_gb?: number;
    gpu_count?: number;
  };
  dockerImage?: string;
  jobCodePath?: string;
  maxBudgetSar?: number;
}

export async function POST(request: Request) {
  try {
    const body: SubmitBody = await request.json();

    if (!body.job_type || !body.duration_minutes) {
      return NextResponse.json(
        { error: 'Missing required fields: job_type, duration_minutes' },
        { status: 400 }
      );
    }

    // If a specific provider was pre-selected (via Rent Now URL params), use it directly.
    // Otherwise find the first online provider that meets VRAM requirements.
    let providerId: number | string | undefined = body.provider_id;

    if (!providerId) {
      const minVram = body.gpu_requirements?.min_vram_gb ?? 0;
      const providersRes = await fetch(`${BACKEND}/api/providers?minVram=${minVram}`);
      if (!providersRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 502 });
      }
      const data = await providersRes.json();
      const online = (data.providers || []).filter(
        (p: { status: string }) => p.status === 'online'
      );
      if (online.length === 0) {
        return NextResponse.json(
          { error: 'No online providers available. Try again shortly or reduce VRAM requirements.' },
          { status: 503 }
        );
      }
      providerId = online[0].id;
    }

    // Forward to backend
    const submitRes = await fetch(`${BACKEND}/api/jobs/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id: providerId,
        job_type: body.job_type,
        duration_minutes: body.duration_minutes,
        gpu_requirements: body.gpu_requirements || null,
        renter_id: 'demo-renter-gate1', // TODO: replace with Supabase auth session (Gate 1)
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({ error: 'Backend submission failed' }));
      return NextResponse.json(
        { error: err.error || 'Job submission failed' },
        { status: submitRes.status }
      );
    }

    const result = await submitRes.json();

    return NextResponse.json({
      success: true,
      job: {
        id: result.job?.id,
        job_id: result.job?.job_id,
        status: result.job?.status,
        provider_id: result.job?.provider_id,
        job_type: result.job?.job_type,
        duration_minutes: result.job?.duration_minutes,
        cost_halala: result.job?.cost_halala,
        submitted_at: result.job?.submitted_at,
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
