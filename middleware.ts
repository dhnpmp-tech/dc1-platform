import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = '__dc1_session'

/**
 * Route protection rules:
 *   /provider/* — requires session role "provider"  (register excluded)
 *   /renter/*   — requires session role "renter"    (register excluded)
 *   /admin/*    — requires session role "admin"
 *
 * On missing/wrong session → redirect to /login with reason + role + redirect params.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public sub-paths that don't require auth
  if (
    pathname === '/provider/register' ||
    pathname.startsWith('/provider/register/') ||
    pathname === '/renter/register' ||
    pathname.startsWith('/renter/register/')
  ) {
    return NextResponse.next()
  }

  const role = request.cookies.get(SESSION_COOKIE)?.value

  if (pathname.startsWith('/provider')) {
    if (role !== 'provider') {
      return buildLoginRedirect(request, 'provider')
    }
  } else if (pathname.startsWith('/renter')) {
    if (role !== 'renter') {
      return buildLoginRedirect(request, 'renter')
    }
  } else if (pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      return buildLoginRedirect(request, 'admin')
    }
  }

  return NextResponse.next()
}

function buildLoginRedirect(request: NextRequest, expectedRole: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('role', expectedRole)
  url.searchParams.set('reason', 'missing_credentials')
  url.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/provider/:path*', '/renter/:path*', '/admin/:path*'],
}
