'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { internalPath } from '@/lib/domain/notifications';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

// Pending residents mark their notifications read too, so these use requireMember, not requireVerified. Row-level
// security (own rows only) and the column grant (read_at only) are the other half of the guard.

/** Marks one notification read, then goes to the page it points at (or back to the list when it points nowhere). */
export async function openNotification(formData: FormData) {
  const profile = await requireMember();
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();

  // Only unread rows, so reopening an old one keeps the time it was first read.
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', profile.id)
    .is('read_at', null);
  if (error) console.error(`notification ${id} was not marked read: ${error.message}`);

  const { data } = await supabase.from('notifications').select('link').eq('id', id).eq('user_id', profile.id).maybeSingle();
  redirect(internalPath(data?.link) ?? '/notifications');
}

export async function markAllRead() {
  const profile = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('read_at', null);
  if (error) console.error(`notifications were not marked read: ${error.message}`);
  refresh(); // re-render this page with the list read and the badge gone
}
