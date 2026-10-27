import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'pse_session';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/contacts',
  '/pipelines',
  '/meetings',
  '/activities',
  '/targets',
  '/admin',
];

function hasNonExpiredJwtStructure(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { userId?: string; exp?: number };
    if (!payload.userId || !payload.exp) return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSession = hasNonExpiredJwtStructure(token);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/contacts/:path*',
    '/pipelines/:path*',
    '/meetings/:path*',
    '/activities/:path*',
    '/targets/:path*',
    '/admin/:path*',
  ],
};
