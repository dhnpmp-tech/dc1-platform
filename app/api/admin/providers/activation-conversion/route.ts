import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://76.13.179.86:8083'

export async function GET() {
  const adminToken = process.env.DC1_ADMIN_TOKEN
  if (!adminToken) {
    return NextResponse.json(
      {
        error: 'Activation conversion telemetry unavailable',
        code: 'ADMIN_TOKEN_NOT_CONFIGURED',
      },
      { status: 503 }
    )
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/providers/activation-conversion`, {
      method: 'GET',
      headers: {
        'x-admin-token': adminToken,
      },
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))

    return NextResponse.json(payload, {
      status: response.status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch activation conversion telemetry',
        details: error instanceof Error ? error.message : 'unknown_error',
      },
      { status: 502 }
    )
  }
}
