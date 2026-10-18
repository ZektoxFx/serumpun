'use server';

import { refresh } from 'next/cache';
import type { MessageKey } from '@/lib/i18n';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** Edit favourites › Save: the services to keep on Home, in order. set_favourites checks the shape again itself. */
export async function saveFavourites(keys: string[]): Promise<{ ok: true } | { ok: false; error: MessageKey }> {
  await requireMember();
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) return { ok: false, error: 'common.error' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_favourites', { p_keys: keys });
  if (error) {
    console.error(`set_favourites failed: ${error.message}`);
    return { ok: false, error: 'common.error' };
  }
  refresh();
  return { ok: true };
}
