import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

// Gate 0 default billing rate
const RATE_HALALA_PER_MIN = 10; // 10 halala/min = ﷼0.10/min = ﷼6/hr

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND}/api/jobs/${id}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: res.status }
      );
    }

    const data = await res.json();
    const job = data.job;

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    const backendStatus = (job.status as string) || 'pending';
    const statusMap: Record<string, string> = {
      pending: 'pending',
      running: 'running',
      completed: 'completed',
      cancelled: 'failed',
      failed: 'failed',
    };
    const mappedStatus = statusMap[backendStatus] || 'pending';

    const startedAt = job.started_at ? new Date(job.started_at).getTime() : null;
    const elapsedMinutes = startedAt ? (Date.now() - startedAt) / 60000 : 0;
    const durationMinutes = Number(job.duration_minutes) || 60;

    let progressPercent: number;
    if (backendStatus === 'completed' || backendStatus === 'cancelled') {
      progressPercent = 100;
    } else if (!startedAt) {
      progressPercent = 0;
    } else {
      progressPercent = Math.min(99, Math.round((elapsedMinutes / durationMinutes) * 100));
    }

    // Total budget derived from duration × rate (Gate 0 flat rate)
    const totalBudgetSar = (durationMinutes * RATE_HALALA_PER_MIN) / 100;

    // cost_halala in the DB is set once at submission time (pre-calculated estimate),
    // not incremented while the job runs. Using it directly would show near-full spend
    // from the first poll. Instead: compute live cost from elapsed runtime × rate.
    // For completed/cancelled jobs, use the stored value as the authoritative final cost.
    const costSoFarSar =
      backendStatus === 'completed' || backendStatus === 'cancelled'
        ? Number(job.cost_halala || 0) / 100
        : Math.min(totalBudgetSar, (elapsedMinutes * RATE_HALALA_PER_MIN) / 100);

    const budgetRemainingSar = Math.max(0, totalBudgetSar - costSoFarSar);

    return NextResponse.json({
      success: true,
      status: {
        jobId: job.job_id || String(job.id),
        status: mappedStatus,
        progressPercent,
        gpuMetrics: {
          utilizationPercent: 0,
          memoryUsedGb: 0,
          memoryTotalGb: 8,
          temperatureC: 0,
        },
        costSoFarSar: Math.round(costSoFarSar * 100) / 100,
        elapsedMinutes: Math.round(elapsedMinutes * 100) / 100,
        budgetRemainingSar: Math.round(budgetRemainingSar * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Job status API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to backend' },
      { status: 502 }
    );
  }
}
