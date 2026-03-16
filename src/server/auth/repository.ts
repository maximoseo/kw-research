import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, ensureRuntimeDirectories } from '@/server/db/client';
import { users } from '@/server/db/schema';

export async function createUser(params: {
  email: string;
  displayName: string;
  passwordHash: string;
}) {
  await ensureRuntimeDirectories();

  const now = Date.now();
  const id = randomUUID();

  await db.insert(users).values({
    id,
    email: params.email.toLowerCase(),
    displayName: params.displayName.trim(),
    passwordHash: params.passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    email: params.email.toLowerCase(),
    displayName: params.displayName.trim(),
  };
}

export async function getUserByEmail(email: string) {
  await ensureRuntimeDirectories();

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertGoogleUser(params: {
  email: string;
  displayName: string;
}) {
  await ensureRuntimeDirectories();

  const existingUser = await getUserByEmail(params.email);
  if (existingUser) {
    return existingUser;
  }

  const now = Date.now();
  const id = randomUUID();

  // For Google users, we set a dummy password hash that cannot be used for regular login
  // since it won't match any real password after bcrypt hashing.
  const passwordHash = 'GOOGLE_OAUTH_USER_' + randomUUID();

  await db.insert(users).values({
    id,
    email: params.email.toLowerCase(),
    displayName: params.displayName.trim(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    email: params.email.toLowerCase(),
    displayName: params.displayName.trim(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getUserById(id: string) {
  await ensureRuntimeDirectories();

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
