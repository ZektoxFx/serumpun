'use server';

import { refresh } from 'next/cache';
import { noticeErrorKey } from '@/lib/domain/notices';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the notice form gets back: done, or a message key. Null before the first press. */
export type NoticeActionResult = { ok: true } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

/** "Send to the office". submit_notice checks the caller, the kind, the dates and the details again itself. */
export async function submitNotice(formData: FormData): Promise<NoticeActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_notice', {
    p_kind: field(formData, 'kind'),
    p_starts_on: field(formData, 'from') || null,
    p_ends_on: field(formData, 'to') || null,
    p_details: field(formData, 'details'),
  });
  if (error) {
    const key = noticeErrorKey(error.message);
    if (key === 'common.error') console.error(`submit_notice failed: ${error.message}`);
    return { ok: false, error: key };
  }
  refresh();
  return { ok: true };
}
