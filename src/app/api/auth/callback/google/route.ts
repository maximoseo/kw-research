import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getAppUrl, getGoogleClientId, getGoogleClientSecret } from '@/lib/env';
import { upsertGoogleUser } from '@/server/auth/repository';
import { buildSessionCookie, createSession } from '@/server/auth/session';

const OAUTH_NONCE_COOKIE = 'google_oauth_nonce';

const googleJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

function errorRedirect(request: Request, redirect: string, message: string) {
  const loginUrl = new URL('/auth/login', getAppUrl());
  loginUrl.searchParams.set('error', message);
  loginUrl.searchParams.set('redirect', redirect);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');

  if (!code || !stateParam) {
    return errorRedirect(request, '/dashboard', 'oauth_callback_failed');
  }

  // Decode state and validate nonce
  let redirect = '/dashboard';
  let nonce: string | undefined;
  try {
    const decoded = JSON.parse(
      Buffer.from(stateParam, 'base64url').toString(),
    );
    redirect = sanitizeRedirectPath(decoded.redirect);
    nonce = decoded.nonce;
  } catch {
    return errorRedirect(request, '/dashboard', 'oauth_callback_failed');
  }

  // Verify CSRF nonce
  const cookieHeader = request.headers.get('cookie') || '';
  const nonceCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OAUTH_NONCE_COOKIE}=`));
  const storedNonce = nonceCookie?.split('=')[1];

  if (!storedNonce || !nonce || storedNonce !== nonce) {
    return errorRedirect(request, redirect, 'oauth_callback_failed');
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    return errorRedirect(request, redirect, 'oauth_not_configured');
  }

  const appUrl = getAppUrl();

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Verify ID token using Google's JWKS
    const { payload } = await jwtVerify(tokens.id_token, googleJWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });

    const email = payload.email as string | undefined;
    const emailVerified = payload.email_verified as boolean | undefined;
    const name = payload.name as string | undefined;

    if (!email || emailVerified !== true) {
      throw new Error('Email not verified by Google');
    }

    // Upsert user and create session
    const user = await upsertGoogleUser({
      email,
      displayName: name || email.split('@')[0],
    });

    const session = await createSession(user.id);
    const cookie = buildSessionCookie(session.token, session.expiresAt);

    const response = NextResponse.redirect(new URL(redirect, appUrl));
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    // Clear the nonce cookie
    response.cookies.set(OAUTH_NONCE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    return errorRedirect(request, redirect, 'oauth_callback_failed');
  }
}
