import { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { verifyPassword } from '@/server/auth/password';
import { getUserByEmail } from '@/server/auth/repository';
import { buildSessionCookie, createSession } from '@/server/auth/session';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
    }

    const user = await getUserByEmail(parsed.data.email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const session = await createSession(user.id);
    const redirectTo = sanitizeRedirectPath(json.redirectTo);
    const response = NextResponse.json({ ok: true, redirectTo });
    const cookie = buildSessionCookie(session.token, session.expiresAt);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to sign in.' }, { status: 500 });
  }
}
