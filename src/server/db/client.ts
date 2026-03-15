import { mkdir } from 'fs/promises';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getDataDir, getDatabaseUrl, getReportsDir, getUploadsDir } from '@/lib/env';
import * as schema from './schema';

let client: ReturnType<typeof createClient> | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function getClient() {
  client ??= createClient({
    url: getDatabaseUrl(),
  });

  return client;
}

export function getDb() {
  database ??= drizzle(getClient(), { schema });
  return database;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const value = (getDb() as unknown as Record<PropertyKey, unknown>)[property];
    return typeof value === 'function' ? value.bind(getDb()) : value;
  },
});

let directoriesReady: Promise<void> | null = null;

export async function ensureRuntimeDirectories() {
  directoriesReady ??= Promise.all([
    mkdir(getDataDir(), { recursive: true }),
    mkdir(getUploadsDir(), { recursive: true }),
    mkdir(getReportsDir(), { recursive: true }),
  ]).then(() => undefined);

  await directoriesReady;
}

export { getClient as client };
