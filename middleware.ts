import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/runs'];
const SESSION_COOKIE_NAME = 'kwr_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/runs/:path*'],
};
