'use server';

import { after } from 'next/server';
import { emergencyErrorKey, withinAlertRadius, type EmergencyKind } from '@/lib/domain/emergency';
import type { LatLng } from '@/lib/domain/geo';
import { neighbourhoodCentre } from '@/lib/domain/places';
import { isLang, t, type MessageKey } from '@/lib/i18n';
import { pushTo } from '@/lib/push';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMember, requireVerified, type SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the emergency sheet gets back: the emergency's id, or a message key. */
export type EmergencyResult = { ok: true; id: string } | { ok: false; error: MessageKey };

function failed(rpc: string, error: { message: string }): EmergencyResult {
  const key = emergencyErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/**
 * Hold ＋, tap: raises an emergency where the sender is, and once they have their answer, alerts the office and every
 * neighbour within 2 km (bell and phone). Tapping again while it is live gives the same one back and alerts nobody twice.
 */
export async function raiseEmergency(place: LatLng): Promise<EmergencyResult> {
  const profile = await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('raise_emergency', { p_lat: place.lat, p_lng: place.lng });
  if (error) return failed('raise_emergency', error);
  const [row] = data as { id: string; is_new: boolean }[];
  if (row.is_new) after(() => alertNeighbours(row.id, place, profile).catch((e) => console.error(`emergency alerts failed: ${e}`)));
  return { ok: true, id: row.id };
}

/** The office and the verified residents whose neighbourhood is within 2 km: a bell notification and a phone alert. */
async function alertNeighbours(id: string, place: LatLng, sender: SessionProfile) {
  const admin = createAdminClient();
  const { data: people, error } = await admin
    .from('profiles')
    .select('id, role, neighbourhood, lang')
    .eq('township_id', sender.township_id)
    .eq('status', 'verified')
    .neq('id', sender.id);
  if (error) throw new Error(`neighbours lookup failed: ${error.message}`);
  const near = people.filter((p) => p.role === 'management' || withinAlertRadius(neighbourhoodCentre(p.neighbourhood), place));
  if (near.length === 0) return;
  const url = `/map?emergency=${id}`;
  // The body is the sender's neighbourhood: a place name reads the same in both languages; who sent it stays private.
  const { error: notifyError } = await admin.rpc('notify', {
    p_users: near.map((p) => p.id),
    p_type: 'emergency',
    p_title_key: 'notify.emergency',
    p_body: sender.neighbourhood,
    p_link: url,
  });
  if (notifyError) throw new Error(`emergency notifications failed: ${notifyError.message}`);
  const messages = new Map(
    near.map((p) => {
      const lang = isLang(p.lang) ? p.lang : 'en';
      return [p.id, { title: t(lang, 'push.emergency.title', { place: sender.neighbourhood }), body: t(lang, 'push.emergency.body'), url, tag: id }];
    }),
  );
  await pushTo(admin, messages);
}

/** "What's happening?": the sender says what it is, for the map and the office. */
export async function setEmergencyKind(id: string, kind: EmergencyKind): Promise<EmergencyResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_emergency_kind', { p_emergency: id, p_kind: kind });
  return error ? failed('set_emergency_kind', error) : { ok: true, id };
}

/** The sender cancels a false alarm ('cancelled'); the office resolves it ('resolved'). close_emergency checks which. */
export async function closeEmergency(id: string, status: 'cancelled' | 'resolved'): Promise<EmergencyResult> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('close_emergency', { p_emergency: id, p_status: status });
  return error ? failed('close_emergency', error) : { ok: true, id };
}

/** Me › Emergency alerts: this phone may be sent alerts (the browser's push subscription), or no longer. */
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<boolean> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
  if (error) console.error(`save_push_subscription failed: ${error.message}`);
  return !error;
}

export async function forgetPushSubscription(endpoint: string): Promise<void> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint });
  if (error) console.error(`delete_push_subscription failed: ${error.message}`);
}
