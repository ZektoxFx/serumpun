'use server';

import { refresh } from 'next/cache';
import { eventErrorKey, mytDateTime } from '@/lib/domain/events';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the event forms get back: the new event's id, or a message key. Null before the first submit. */
export type EventActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, township, category, times and event again themselves: these actions only pass the form on.
function failed(rpc: string, error: { message: string }): EventActionResult {
  const key = eventErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/**
 * A new event: a resident's (optionally asking for points), or, from the dashboard, the Management Office's official
 * one. The date and times are Malaysian, from the browser's date and time pickers.
 */
export async function createEvent(formData: FormData): Promise<EventActionResult> {
  await requireVerified();
  const date = field(formData, 'date');
  const starts = mytDateTime(date, field(formData, 'start'));
  const ends = mytDateTime(date, field(formData, 'end'));
  if (!starts || !ends) return { ok: false, error: 'event.error.time' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_event', {
    p_title: field(formData, 'title'),
    p_description: field(formData, 'description'),
    p_category: field(formData, 'category'),
    p_starts_at: starts.toISOString(),
    p_ends_at: ends.toISOString(),
    p_location_text: field(formData, 'place'),
    p_ask_points: formData.get('askPoints') === 'on',
  });
  if (error) return failed('create_event', error);
  refresh();
  return { ok: true, id: String(data) };
}

/** "Join" (going = "yes") or no longer going. */
export async function setGoing(formData: FormData): Promise<EventActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const rpc = field(formData, 'going') === 'yes' ? 'rsvp_event' : 'cancel_rsvp';
  const { error } = await supabase.rpc(rpc, { p_event: field(formData, 'id') });
  if (error) return failed(rpc, error);
  refresh();
  return { ok: true };
}
