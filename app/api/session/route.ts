import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SESSION_COOKIE = '__dc1_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const VALID_ROLES = new Set(['provider', 'renter', 'admin'])

/** POST /api/session — sets the session cookie after successful login */
export async function POST(request: NextRequest) {
  let body: { role?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { role } = body
  if (!role || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}

/** DELETE /api/session — clears the session cookie on logout */
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
