// Run with `npm run db:seed:cards`: it only adds and updates card rows (units, cards, who is on them, phones, PINs), plus
// any seeded person who is missing. It wipes and deletes nothing, so it is safe on the shared database and to re-run.
import { seedCards } from '@/lib/seed/cards';
import { ensurePeople } from '@/lib/seed/people';
import { createAdminClient } from '@/lib/supabase/admin';

async function main() {
  const admin = createAdminClient();
  const now = new Date();
  await seedCards(admin, now, await ensurePeople(admin, now));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
