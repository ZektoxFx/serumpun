import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { env } from '@/lib/env';

// Run with `npm run db:migrate` from the repo root: applies supabase/migrations/*.sql in name order, once each.
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

async function main() {
  const sql = postgres(env.databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from _migrations`).map((row) => row.name));
    const pending = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql') && !done.has(file)).sort();

    for (const file of pending) {
      const text = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      // One transaction per file: a failing statement leaves neither half a migration nor a ledger row behind.
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into _migrations (name) values (${file})`;
      });
      console.log(`applied ${file}`);
    }
    if (!pending.length) console.log('up to date');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
