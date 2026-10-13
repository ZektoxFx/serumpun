import { seedAll } from '@/lib/seed';
import { createAdminClient } from '@/lib/supabase/admin';

// Run with `npm run db:seed`: wipes the demo data and seeds it again, timed relative to now. Safe to re-run.
async function main() {
  await seedAll(createAdminClient(), new Date());
  console.log('seeded');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
