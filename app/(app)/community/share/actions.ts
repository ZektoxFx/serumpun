'use server';

import { refresh } from 'next/cache';
import { shareErrorKey } from '@/lib/domain/community';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the Share & Lend forms and buttons get back: the new row's id, or a message key. Null before the first press. */
export type ShareActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, the item, the dates and the step again themselves: these actions only pass the form on.
function failed(rpc: string, error: { message: string }): ShareActionResult {
  const key = shareErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/** "List an item": something to lend, give away or swap, and, if a group is picked, a post about it there. */
export async function createListing(formData: FormData): Promise<ShareActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_listing', {
    p_kind: field(formData, 'kind'),
    p_title: field(formData, 'title'),
    p_description: field(formData, 'description'),
    p_emoji: field(formData, 'emoji'),
    p_swap_for: field(formData, 'swapFor'),
    p_available_until: field(formData, 'availableUntil') || null,
    p_group: field(formData, 'group') || null,
  });
  if (error) return failed('create_listing', error);
  return { ok: true, id: String(data) };
}

/** "Request to borrow", for the dates picked. */
export async function requestBorrow(formData: FormData): Promise<ShareActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_borrow', {
    p_listing: field(formData, 'listing'),
    p_from: field(formData, 'from') || null,
    p_to: field(formData, 'to') || null,
  });
  if (error) return failed('request_borrow', error);
  refresh();
  return { ok: true, id: String(data) };
}

/** One step of a borrow request: approve, decline, picked up, returned (the owner) or cancel (the borrower). */
export async function advanceBorrow(formData: FormData): Promise<ShareActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('advance_borrow', { p_request: field(formData, 'id'), p_next: field(formData, 'next') });
  if (error) return failed('advance_borrow', error);
  refresh();
  return { ok: true };
}

/**
 * The owner takes a listing down: given away, or no longer offered. No refresh: the button moves on to My listings,
 * and the listing's own page would be gone.
 */
export async function closeListing(formData: FormData): Promise<ShareActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('close_listing', { p_listing: field(formData, 'id') });
  if (error) return failed('close_listing', error);
  return { ok: true };
}
