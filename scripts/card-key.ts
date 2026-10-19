import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generateSigningKey } from '@/lib/card/crypto';

// Run with `npm run card:key` from the repo root: gives .env.local a CARD_SIGNING_KEY if it has none. Never prints the key.
const ENV_FILE = path.join(process.cwd(), '.env.local');

async function main() {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  if (/^CARD_SIGNING_KEY=/m.test(text)) {
    console.log('CARD_SIGNING_KEY already in .env.local');
    return;
  }
  // Without a final newline the new line would be glued onto the file's last variable and corrupt it.
  const lead = text && !text.endsWith('\n') ? '\n' : '';
  appendFileSync(ENV_FILE, `${lead}CARD_SIGNING_KEY=${await generateSigningKey()}\n`);
  console.log('CARD_SIGNING_KEY added to .env.local');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
