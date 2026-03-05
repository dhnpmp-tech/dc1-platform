import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

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

    const costHalala = Number(job.cost_halala) || 0;
    const costSoFarSar = costHalala / 100;
    // Gate 0: default rate 10 halala/min
    const budgetRemainingSar = Math.max(0, (durationMinutes * 10 / 100) - costSoFarSar);

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
        costSoFarSar,
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
