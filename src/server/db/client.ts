import { mkdir } from 'fs/promises';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getDataDir, getDatabaseUrl, getReportsDir, getUploadsDir } from '@/lib/env';
import * as schema from './schema';

const client = createClient({
  url: getDatabaseUrl(),
});

export const db = drizzle(client, { schema });

let directoriesReady: Promise<void> | null = null;

export async function ensureRuntimeDirectories() {
  directoriesReady ??= Promise.all([
    mkdir(getDataDir(), { recursive: true }),
    mkdir(getUploadsDir(), { recursive: true }),
    mkdir(getReportsDir(), { recursive: true }),
  ]).then(() => undefined);

  await directoriesReady;
}

export { client };
