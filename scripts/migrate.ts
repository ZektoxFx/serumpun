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
    // Supabase exposes every public table to the API roles. RLS with no policy hides the ledger from them; this role bypasses it.
    await sql`alter table _migrations enable row level security`;
    const done = new Set((await sql<{ name: string }[]>`select name from _migrations`).map((row) => row.name));
    const pending = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql') && !done.has(file)).sort();

    for (const file of pending) {
      // Windows editors and PowerShell 5's `>` can prepend a UTF-8 BOM (U+FEFF), which Postgres reads as a syntax error.
      const raw = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
      try {
        // One transaction per file: a failing statement leaves neither half a migration nor a ledger row behind.
        await sql.begin(async (tx) => {
          await tx.unsafe(text);
          await tx`insert into _migrations (name) values (${file})`;
        });
      } catch (error) {
        throw describeFailure(file, text, error);
      }
      console.log(`applied ${file}`);
    }
    if (!pending.length) console.log('up to date');
  } finally {
    await sql.end();
  }
}

/** "0001_core.sql line 42 (position 1234): syntax error ..." plus Postgres's detail and hint when it gives them. */
function describeFailure(file: string, text: string, error: unknown) {
  const { message, position, detail, hint } = error as { message?: string; position?: string; detail?: string; hint?: string };
  // `position` is a 1-based character offset into the file, which was sent as one query.
  const where = position ? ` line ${text.slice(0, Number(position) - 1).split('\n').length} (position ${position})` : '';
  const lines = [`${file}${where}: ${message ?? String(error)}`];
  if (detail) lines.push(`detail: ${detail}`);
  if (hint) lines.push(`hint: ${hint}`);
  return new Error(lines.join('\n'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
