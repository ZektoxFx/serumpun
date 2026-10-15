'use server';

import { alertErrorKey } from '@/lib/domain/alerts';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the map's forms get back: the new alert's id, or a message key. Null before the first submit. */
export type MapActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, township, type, severity, area and note again themselves: these actions only pass the form on.
function failed(rpc: string, error: { message: string }): MapActionResult {
  const key = alertErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/** Drops a pin where the resident put it. It fades 2 hours after the last "still there". */
export async function dropAlert(formData: FormData): Promise<MapActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_alert', {
    p_type: field(formData, 'type'),
    p_severity: field(formData, 'severity'),
    p_lat: Number(field(formData, 'lat')),
    p_lng: Number(field(formData, 'lng')),
    p_note: field(formData, 'note'),
    p_photo_path: field(formData, 'photo') || null, // uploaded by the form just before; the RPC checks it is the caller's
  });
  if (error) return failed('create_alert', error);
  return { ok: true, id: String(data) };
}

/** "Still there" or "Gone" on a neighbour's alert. Changing your mind replaces your earlier vote. */
export async function voteAlert(formData: FormData): Promise<MapActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('vote_alert', { p_alert: field(formData, 'id'), p_vote: field(formData, 'vote') });
  if (error) return failed('vote_alert', error);
  return { ok: true };
}
