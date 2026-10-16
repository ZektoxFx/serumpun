'use server';

import { refresh } from 'next/cache';
import { messageErrorKey } from '@/lib/domain/messages';
import type { MessageKey } from '@/lib/i18n';
import { requireMember, requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the Message buttons and the composer get back: the conversation's id, or a message key. Null before the first press. */
export type MessageActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, the context and the membership themselves: these actions only pass the form on.
function failed(rpc: string, error: { message: string }): MessageActionResult {
  const key = messageErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/** "Message [owner]": the conversation about this context with whoever posted it, new or the one already there. */
export async function startConversation(formData: FormData): Promise<MessageActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_conversation', {
    p_context_type: field(formData, 'type'),
    p_context_id: field(formData, 'id'),
  });
  if (error) return failed('start_conversation', error);
  return { ok: true, id: String(data) };
}

export async function sendMessage(formData: FormData): Promise<MessageActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('send_message', { p_conversation: field(formData, 'conversation'), p_body: field(formData, 'body') });
  if (error) return failed('send_message', error);
  refresh();
  return { ok: true };
}

/**
 * The member has the conversation open: it stops counting as unread. Called once the page shows, never while rendering
 * (a prefetch from the inbox would count as reading it). The refresh updates the badge and the client's cached inbox.
 */
export async function markRead(conversationId: string): Promise<void> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation: conversationId });
  if (error) return console.error(`mark_conversation_read failed: ${error.message}`); // the unread dot stays: no broken page
  refresh();
}
