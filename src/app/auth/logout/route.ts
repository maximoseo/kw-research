import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSessionCookie, invalidateSession, SESSION_COOKIE_NAME } from '@/server/auth/session';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/auth/login', request.url));
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;

  await invalidateSession(token);
  const cookie = clearSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
