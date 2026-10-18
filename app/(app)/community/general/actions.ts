'use server';

import { refresh } from 'next/cache';
import { topicErrorKey } from '@/lib/domain/topics';
import type { MessageKey } from '@/lib/i18n';
import { requireMember, requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the topic's composer gets back: sent, or a message key. Null before the first send. */
export type TopicActionResult = { ok: true } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

/** Posts in a topic of General chat. send_topic_message checks the caller, the topic and office-only itself. */
export async function sendTopicMessage(formData: FormData): Promise<TopicActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('send_topic_message', { p_topic: field(formData, 'topic'), p_body: field(formData, 'body') });
  if (error) {
    const key = topicErrorKey(error.message);
    if (key === 'common.error') console.error(`send_topic_message failed: ${error.message}`);
    return { ok: false, error: key };
  }
  refresh();
  return { ok: true };
}

/** The reader has the topic open: its messages stop counting as unread. Called once the page shows, as markRead is. */
export async function markTopicRead(topicId: string): Promise<void> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_topic_read', { p_topic: topicId });
  if (error) return console.error(`mark_topic_read failed: ${error.message}`); // the unread count stays: no broken page
  refresh();
}
