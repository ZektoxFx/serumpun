import 'server-only';
import type { Mall } from '@/lib/domain/malls';
import { MAX_PLATES, parkingFee, parkingRef, pretendMinutes, type PayMethod } from '@/lib/domain/parking';
import { mytDate } from '@/lib/domain/time';
import { createAdminClient } from '@/lib/supabase/admin';

// The demo parking payment's server side (spec §4.3). Trusted code with the service role: residents have no access to
// vehicles or parking_sessions, and every query here is pinned to the signed-in resident's own id.

const MINUTE = 60_000;
const SESSION_COLUMNS = 'id, entered_at, created_at, paid_at, exit_by';
type Session = { id: string; entered_at: string; created_at: string; paid_at: string | null; exit_by: string | null };

export type ParkingQuote =
  | { kind: 'due'; sessionId: string; plate: string; enteredAt: string; minutes: number; feeSen: number; taxSen: number; totalSen: number }
  | { kind: 'paid'; plate: string; exitBy: string };

const minutesSince = (iso: string, now: Date) => Math.ceil((now.getTime() - Date.parse(iso)) / MINUTE);

/** Keeps the plate first among the resident's cars, and only their 5 most recent. */
async function rememberPlate(userId: string, plate: string, now: Date) {
  const admin = createAdminClient();
  const { error } = await admin.from('vehicles').upsert({ user_id: userId, plate, last_used_at: now.toISOString() });
  if (error) throw new Error(`vehicles: ${error.message}`);
  const { data } = await admin.from('vehicles').select('plate').eq('user_id', userId).order('last_used_at', { ascending: false });
  const extra = (data ?? []).slice(MAX_PLATES).map((v) => v.plate);
  if (extra.length) await admin.from('vehicles').delete().eq('user_id', userId).in('plate', extra);
}

/**
 * "Check amount": still inside the exit window of a payment → paid; else today's unpaid session for this plate, or a
 * new one whose pretend entry time is the same all day for this resident, mall and plate. The amount is worked out now.
 */
export async function checkParking(userId: string, mall: Mall, plate: string, now: Date): Promise<ParkingQuote> {
  const admin = createAdminClient();
  const { data: recent, error } = await admin
    .from('parking_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', userId)
    .eq('mall', mall.slug)
    .eq('plate', plate)
    .order('created_at', { ascending: false })
    .limit(5)
    .overrideTypes<Session[], { merge: false }>();
  if (error) throw new Error(`parking sessions: ${error.message}`);
  await rememberPlate(userId, plate, now);
  const paid = recent.find((s) => s.exit_by !== null && Date.parse(s.exit_by) > now.getTime());
  if (paid) return { kind: 'paid', plate, exitBy: paid.exit_by! };
  let session = recent.find((s) => s.paid_at === null && mytDate(new Date(s.created_at)) === mytDate(now));
  if (!session) {
    const enteredAt = new Date(now.getTime() - pretendMinutes(`${userId}|${mall.slug}|${plate}|${mytDate(now)}`) * MINUTE);
    const { data, error: insertError } = await admin
      .from('parking_sessions')
      .insert({ user_id: userId, mall: mall.slug, plate, entered_at: enteredAt.toISOString() })
      .select(SESSION_COLUMNS)
      .single()
      .overrideTypes<Session, { merge: false }>();
    if (insertError) throw new Error(`parking session: ${insertError.message}`);
    session = data;
  }
  const minutes = minutesSince(session.entered_at, now);
  return { kind: 'due', sessionId: session.id, plate, enteredAt: session.entered_at, minutes, ...parkingFee(mall.rate, minutes) };
}

/** "Pay": marks the session paid (no money moves) with the amount worked out again now. Null if it is not the resident's
 *  unpaid session, including a second press after the first went through. */
export async function payParking(userId: string, mall: Mall, sessionId: string, method: PayMethod, now: Date) {
  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from('parking_sessions')
    .select('entered_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('mall', mall.slug)
    .is('paid_at', null)
    .maybeSingle();
  if (error) throw new Error(`parking session: ${error.message}`);
  if (!session) return null;
  const { totalSen } = parkingFee(mall.rate, minutesSince(session.entered_at, now));
  const exitBy = new Date(now.getTime() + mall.graceMinutes * MINUTE).toISOString();
  // A five-digit reference can repeat another session's: try the id's later parts before giving up.
  for (const offset of [0, 9, 14, 19, 24]) {
    const ref = parkingRef(sessionId.slice(offset));
    const { data, error: payError } = await admin
      .from('parking_sessions')
      .update({ paid_at: now.toISOString(), method, total_sen: totalSen, exit_by: exitBy, ref })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('paid_at', null)
      .select('id')
      .maybeSingle();
    if (payError?.code === '23505') continue;
    if (payError) throw new Error(`parking payment: ${payError.message}`);
    return data ? { ref, exitBy, totalSen } : null;
  }
  throw new Error('parking payment: no free reference');
}

/** The resident's saved plates, the most recently used first. */
export async function savedPlates(userId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('vehicles')
    .select('plate')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })
    .limit(MAX_PLATES);
  if (error) throw new Error(`vehicles: ${error.message}`);
  return data.map((v) => v.plate);
}
