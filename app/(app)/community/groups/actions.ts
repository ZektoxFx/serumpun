'use server';

import { refresh } from 'next/cache';
import { groupErrorKey } from '@/lib/domain/community';
import type { MessageKey } from '@/lib/i18n';
import { requireMember, requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the group buttons and forms get back: the new row's id, or a message key. Null before the first press. */
export type GroupActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, township and membership themselves: these actions only pass the form on.
function failed(rpc: string, error: { message: string }): GroupActionResult {
  const key = groupErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/** A new group of the township; whoever creates it is its admin. */
export async function createGroup(formData: FormData): Promise<GroupActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_group', {
    p_name: field(formData, 'name'),
    p_category: field(formData, 'category'),
    p_description: field(formData, 'description'),
    p_rules: field(formData, 'rules'),
  });
  if (error) return failed('create_group', error);
  return { ok: true, id: String(data) };
}

/** Join (member = "yes") or leave a group. */
export async function setMember(formData: FormData): Promise<GroupActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const rpc = field(formData, 'member') === 'yes' ? 'join_group' : 'leave_group';
  const { error } = await supabase.rpc(rpc, { p_group: field(formData, 'id') });
  if (error) return failed(rpc, error);
  refresh();
  return { ok: true };
}

/**
 * The member has the group open: its posts so far stop counting as new. Called once the page shows, never while
 * rendering (a prefetch would count as a visit). The refresh also drops the client's cached Groups tab, so going back
 * shows the badge gone.
 */
export async function markVisited(groupId: string): Promise<void> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_group_visited', { p_group: groupId });
  if (error) return console.error(`mark_group_visited failed: ${error.message}`); // a stale "N new" beats a broken page
  refresh();
}

export async function createPost(formData: FormData): Promise<GroupActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_post', {
    p_group: field(formData, 'group'),
    p_type: field(formData, 'type'),
    p_body: field(formData, 'body'),
  });
  if (error) return failed('create_post', error);
  refresh();
  return { ok: true, id: String(data) };
}

export async function addComment(formData: FormData): Promise<GroupActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_comment', { p_post: field(formData, 'post'), p_body: field(formData, 'body') });
  if (error) return failed('add_comment', error);
  refresh();
  return { ok: true, id: String(data) };
}

/** Helpful (helpful = "yes") or not any more. */
export async function setHelpful(formData: FormData): Promise<GroupActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_helpful', { p_comment: field(formData, 'id'), p_helpful: field(formData, 'helpful') === 'yes' });
  if (error) return failed('set_helpful', error);
  refresh();
  return { ok: true };
}
