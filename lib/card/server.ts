import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { importSigningKey, PASS_TTL_SECONDS, signPass, type PublicJwk } from './crypto';

/** What `register_phone_key` refuses with; any other error is `failed`. */
const REFUSALS = ['no_card', 'card_full', 'bad_key', 'phone_elsewhere'] as const;
/** `move_waiting`: this browser's key waits for the old phone or a manager to move the card to it. `moved`: it moved away. */
export type IssueResult = { pass: string } | { error: (typeof REFUSALS)[number] | 'move_waiting' | 'moved' | 'failed' };

// The key never changes while the server runs, so it is imported once. Kept with its text, so a different key is imported afresh.
let imported: { encoded: string; key: Promise<CryptoKey> } | undefined;
function signingKeyFor(encoded: string): Promise<CryptoKey> {
  if (imported?.encoded !== encoded) imported = { encoded, key: importSigningKey(encoded) };
  return imported.key;
}

/**
 * Registers the caller's browser key on their phone (the database finds the card and checks the key and the phone limit)
 * and signs a pass for it that the township's readers accept for the next 24 hours. A key that waits for the card to move
 * to it, or that the card has moved away from, gets no pass. `supabase` acts as the caller.
 */
export async function issuePass(supabase: SupabaseClient, key: PublicJwk, now: Date, signingKey: string): Promise<IssueResult> {
  // It arrives from the browser, so it may not be a key at all. Only once x and y are text can the database check their format.
  if (typeof key?.x !== 'string' || typeof key?.y !== 'string') return { error: 'bad_key' };
  const { data, error } = await supabase.rpc('register_phone_key', { p_x: key.x, p_y: key.y });
  if (error) {
    const refusal = REFUSALS.find((code) => code === error.message);
    if (!refusal) console.error(`register_phone_key failed: ${error.message}`);
    return { error: refusal ?? 'failed' };
  }
  if (data.waiting) return { error: 'move_waiting' };
  if (data.moved) return { error: 'moved' };
  const iat = Math.floor(now.getTime() / 1000);
  const pass = await signPass(
    {
      v: 1, card: data.card, unit: data.unit, township: data.township, phone: data.phone,
      // Rebuilt from x and y, which the database has checked: the browser's own object is never signed as it came.
      key: { kty: 'EC', crv: 'P-256', x: key.x, y: key.y },
      places: data.places, suspended: data.suspended, leaseEnd: data.lease_end, iat, exp: iat + PASS_TTL_SECONDS,
    },
    await signingKeyFor(signingKey),
  );
  return { pass };
}
