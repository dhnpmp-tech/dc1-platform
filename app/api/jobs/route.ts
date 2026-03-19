export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/jobs/active`, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch jobs from backend' },
        { status: res.status }
      );
    }

    const data = await res.json();
    const jobs = (data.jobs || []).map((j: Record<string, unknown>) => {
      const gpuReqs = j.gpu_requirements
        ? (typeof j.gpu_requirements === 'string'
            ? JSON.parse(j.gpu_requirements as string)
            : j.gpu_requirements as Record<string, unknown>)
        : null;
      return {
      id: String(j.id),
      name: (j.job_id as string) || (j.job_type as string) || 'Job',
      renter: 'DC1 Renter', // No renter info in backend schema yet
      gpu: gpuReqs?.docker_image || gpuReqs?.gpu_model || (j.job_type as string) || 'GPU',
      status: mapStatus(j.status as string),
      costSoFar: Number(j.cost_halala || 0) / 100,
      submittedAt: j.submitted_at,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      providerId: j.provider_id,
      durationMinutes: j.duration_minutes,
    }; });

    return NextResponse.json(
      { jobs },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Jobs API error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 502 }
    );
  }
}

function mapStatus(status: string): 'queued' | 'running' | 'completed' | 'failed' {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'queued';
  }
}
