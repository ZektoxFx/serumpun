'use server';

import { refresh } from 'next/cache';
import { bookingErrorKey } from '@/lib/domain/booking';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What Confirm booking and Cancel booking get back: the new booking's id, or a message key. Null before the first press. */
export type BookActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, the day, the hour, the slot and the household again themselves: these actions pass the form on.
function failed(rpc: string, error: { message: string }): BookActionResult {
  const key = bookingErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/**
 * "Confirm booking": one slot of one court, and how many players it needs (0 without Find players). Refreshes Book a
 * Court either way, so a slot someone just took shows as taken.
 */
export async function bookSlot(formData: FormData): Promise<BookActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('book_slot', {
    p_facility: field(formData, 'facility'),
    p_date: field(formData, 'date'),
    p_hour: Number(field(formData, 'hour')),
    p_players_needed: Number(field(formData, 'players') || 0),
  });
  refresh();
  if (error) return failed('book_slot', error);
  return { ok: true, id: String(data) };
}

/** "Cancel booking", free until 2 hours before the start. */
export async function cancelBooking(formData: FormData): Promise<BookActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_booking', { p_booking: field(formData, 'id') });
  if (error) return failed('cancel_booking', error);
  refresh();
  return { ok: true };
}

/** "Join" an open game (join = "yes"), or leave it. */
export async function setJoined(formData: FormData): Promise<BookActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const rpc = field(formData, 'join') === 'yes' ? 'join_game' : 'leave_game';
  const { error } = await supabase.rpc(rpc, { p_booking: field(formData, 'id') });
  // No refresh on a failure: the card stays to say why (full, started, cancelled).
  if (error) return failed(rpc, error);
  refresh();
  return { ok: true };
}
