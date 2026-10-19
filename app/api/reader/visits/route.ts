import { publicJwkFromSigningKey } from '@/lib/card/crypto';
import { adminReaderDeps, handleVisits } from '@/lib/card/reader-server';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * A reader that was offline posts the taps it decided by itself once it is back. Public: only visits whose signatures
 * check out are saved. The answer counts what was saved and what was skipped, and a body that is not JSON counts none.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const answer = await handleVisits(body, adminReaderDeps(createAdminClient(), publicJwkFromSigningKey(env.cardSigningKey)));
  return Response.json(answer, { headers: NO_STORE });
}
