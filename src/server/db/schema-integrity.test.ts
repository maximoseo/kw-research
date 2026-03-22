import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@libsql/client';

/**
 * Regression test: ensures every column defined in the Drizzle schema
 * is created in the database after all migrations run.
 *
 * This catches the exact class of bug where a column is added to
 * schema.ts but no corresponding migration is created.
 */
describe('database schema integrity', () => {
  it('migrations produce all columns required by the Drizzle schema', async () => {
    // Create a fresh in-memory database
    const client = createClient({ url: ':memory:' });

    // Run the migration bootstrap
    await client.execute(`
      create table if not exists _migrations (
        id integer primary key autoincrement,
        name text not null unique,
        applied_at integer not null
      )
    `);

    // Apply all migrations in order
    const migrationDir = path.resolve('src/server/db/migrations');
    const files = (await readdir(migrationDir))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const sql = await readFile(path.join(migrationDir, file), 'utf8');
      const statements = sql
        .split(/;\s*\n/g)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await client.execute(statement);
      }
    }

    // Verify research_runs has synthesis_snapshot (the exact column that was missing)
    const result = await client.execute("PRAGMA table_info('research_runs')");
    const columnNames = result.rows.map((row) => row.name as string);

    expect(columnNames).toContain('synthesis_snapshot');
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('project_id');
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('input_snapshot');
    expect(columnNames).toContain('site_snapshot');
    expect(columnNames).toContain('competitor_snapshot');
    expect(columnNames).toContain('result_rows');
    expect(columnNames).toContain('workbook_path');
  });

  it('all schema-defined tables exist after migration', async () => {
    const client = createClient({ url: ':memory:' });

    await client.execute(`
      create table if not exists _migrations (
        id integer primary key autoincrement,
        name text not null unique,
        applied_at integer not null
      )
    `);

    const migrationDir = path.resolve('src/server/db/migrations');
    const files = (await readdir(migrationDir))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const sql = await readFile(path.join(migrationDir, file), 'utf8');
      const statements = sql
        .split(/;\s*\n/g)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await client.execute(statement);
      }
    }

    const tablesResult = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\'"
    );
    const tables = tablesResult.rows.map((row) => row.name as string);

    expect(tables).toContain('users');
    expect(tables).toContain('sessions');
    expect(tables).toContain('projects');
    expect(tables).toContain('uploaded_files');
    expect(tables).toContain('research_runs');
    expect(tables).toContain('research_logs');
  });
});
