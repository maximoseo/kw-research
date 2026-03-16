import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getAppUrl, getGoogleClientId, isGoogleOAuthConfigured } from '@/lib/env';

const OAUTH_NONCE_COOKIE = 'google_oauth_nonce';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = sanitizeRedirectPath(searchParams.get('redirect'));

  if (!isGoogleOAuthConfigured()) {
    const loginUrl = new URL('/auth/login', getAppUrl());
    loginUrl.searchParams.set('error', 'oauth_not_configured');
    loginUrl.searchParams.set('redirect', redirect);
    return NextResponse.redirect(loginUrl);
  }

  const nonce = randomBytes(32).toString('base64url');
  const state = Buffer.from(
    JSON.stringify({ redirect, nonce }),
  ).toString('base64url');

  const appUrl = getAppUrl();
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', getGoogleClientId()!);
  googleAuthUrl.searchParams.set(
    'redirect_uri',
    `${appUrl}/api/auth/callback/google`,
  );
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('access_type', 'online');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 300, // 5 minutes
  });

  return response;
}
