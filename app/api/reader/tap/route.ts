import { publicJwkFromSigningKey } from '@/lib/card/crypto';
import { adminReaderDeps, handleTap } from '@/lib/card/reader-server';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * An online reader posts what it read off a card and gets the server's decision. Public: the signatures on the card are
 * the proof. The answer carries the unit's label and never a name. A body that is not JSON is read as no body at all.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const answer = await handleTap(body, adminReaderDeps(createAdminClient(), publicJwkFromSigningKey(env.cardSigningKey)));
  return Response.json(answer, { status: 'error' in answer ? 400 : 200, headers: NO_STORE });
}
