import type { NextRequest } from 'next/server';
import { publicJwkFromSigningKey } from '@/lib/card/crypto';
import { loadSync } from '@/lib/card/reader-server';
import { isUuid } from '@/lib/domain/reports';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * What a reader keeps to work offline: the township's public key, the server's clock, the stop list and today's
 * bookings. Public, like the reader page. It holds card and phone ids, court ids and hours: no name and no unit.
 */
export async function GET(request: NextRequest) {
  const township = request.nextUrl.searchParams.get('township');
  // Anyone can send anything here, and Postgres would refuse text that is not an id with an error, not with "no rows".
  if (township === null || !isUuid(township)) return Response.json({ error: 'bad_township' }, { status: 400, headers: NO_STORE });
  const sync = await loadSync(createAdminClient(), township, new Date());
  return Response.json({ publicKey: publicJwkFromSigningKey(env.cardSigningKey), ...sync }, { headers: NO_STORE });
}
