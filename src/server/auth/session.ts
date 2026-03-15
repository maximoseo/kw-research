import { cookies } from 'next/headers';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db, ensureRuntimeDirectories } from '@/server/db/client';
import { sessions, users } from '@/server/db/schema';
import type { AuthUser } from './types';

export const SESSION_COOKIE_NAME = 'kwr_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_REFRESH_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string) {
  await ensureRuntimeDirectories();

  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    lastSeenAt: now,
    createdAt: now,
  });

  return {
    token,
    expiresAt,
  };
}

export async function invalidateSession(token: string | null | undefined) {
  if (!token) {
    return;
  }

  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function getSessionUser(token: string | null | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  await ensureRuntimeDirectories();

  const tokenHash = hashToken(token);
  const now = Date.now();
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  if (row.expiresAt - now < SESSION_REFRESH_WINDOW_MS) {
    await db
      .update(sessions)
      .set({
        expiresAt: now + SESSION_TTL_MS,
        lastSeenAt: now,
      })
      .where(eq(sessions.id, row.sessionId));
  } else {
    await db
      .update(sessions)
      .set({
        lastSeenAt: now,
      })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
  };
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return getSessionUser(token);
}

export function buildSessionCookie(token: string, expiresAt: number) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(expiresAt),
    },
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    },
  };
}
