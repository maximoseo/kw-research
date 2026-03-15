import { NextResponse } from 'next/server';
import { createSession, buildSessionCookie } from '@/server/auth/session';
import { createUser, getUserByEmail } from '@/server/auth/repository';
import { hashPassword } from '@/server/auth/password';
import { registerSchema } from '@/lib/validation';
import { sanitizeRedirectPath } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
    }

    const existing = await getUserByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      passwordHash,
    });
    const session = await createSession(user.id);
    const redirectTo = sanitizeRedirectPath(json.redirectTo);
    const response = NextResponse.json({ ok: true, redirectTo });
    const cookie = buildSessionCookie(session.token, session.expiresAt);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create the account.' }, { status: 500 });
  }
}
