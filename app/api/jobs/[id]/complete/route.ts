import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const renterKey = request.headers.get('x-renter-key');
    const res = await fetch(`${BACKEND}/api/jobs/${id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(renterKey ? { 'x-renter-key': renterKey } : {}),
      },
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return NextResponse.json(
        { success: false, error: data.error || 'Failed to complete job' },
        { status: res.status || 400 }
      );
    }

    const job = data.job || {};

    return NextResponse.json({
      success: true,
      result: {
        totalCostSar: Number(job.cost_halala || 0) / 100,
        totalMinutes: Number(job.duration_minutes || 0),
        gpuWiped: false, // Gate 0: not implemented in daemon
        payoutTriggered: true,
      },
    });
  } catch (error) {
    console.error('Job complete API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to backend' },
      { status: 502 }
    );
  }
}
