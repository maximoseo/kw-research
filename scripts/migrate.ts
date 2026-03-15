import { mkdir, readdir, readFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@libsql/client';

function resolveDataDir() {
  return path.resolve(process.env.DATA_DIR || '.data');
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  return `file:${path.join(resolveDataDir(), 'kw-research.db')}`;
}

async function main() {
  const dataDir = resolveDataDir();
  await mkdir(dataDir, { recursive: true });

  const client = createClient({
    url: resolveDatabaseUrl(),
  });

  await client.execute(`
    create table if not exists _migrations (
      id integer primary key autoincrement,
      name text not null unique,
      applied_at integer not null
    )
  `);

  const migrationDir = path.resolve('src/server/db/migrations');
  const files = (await readdir(migrationDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const appliedRows = await client.execute('select name from _migrations');
  const applied = new Set(appliedRows.rows.map((row) => String(row.name)));

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(migrationDir, file), 'utf8');
    const statements = sql
      .split(/;\s*\n/g)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.execute(statement);
    }

    await client.execute({
      sql: 'insert into _migrations (name, applied_at) values (?, ?)',
      args: [file, Date.now()],
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
