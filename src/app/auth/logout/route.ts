import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAppUrl } from '@/lib/env';
import { SELECTED_PROJECT_COOKIE_NAME } from '@/lib/project-context';
import { clearSessionCookie, invalidateSession, SESSION_COOKIE_NAME } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const response = NextResponse.redirect(new URL('/auth/login', getAppUrl()));
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;

  await invalidateSession(token);
  const cookie = clearSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  response.cookies.set(SELECTED_PROJECT_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  return response;
}
