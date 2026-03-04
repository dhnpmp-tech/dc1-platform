import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${BACKEND}/api/jobs/${params.id}`);

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch job from backend' },
        { status: res.status }
      );
    }

    const job = await res.json();

    return NextResponse.json(
      { job },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Job detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 502 }
    );
  }
}
