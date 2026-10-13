'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isLang, type Lang } from './core';

/**
 * Remembers the chosen language for a year in a cookie, and on the profile when someone is signed in. Setting a cookie
 * re-renders the current page, now in that language.
 */
export async function setLang(lang: Lang) {
  if (!isLang(lang)) return; // it arrives from the browser
  (await cookies()).set('lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) return; // the landing page: nobody is signed in
  // Row-level security keeps this to the caller's own row, and the column grant to `lang`.
  const { error } = await supabase.from('profiles').update({ lang }).eq('id', id);
  // The cookie already switched this page; a failed save only means the profile keeps its old language.
  if (error) console.error(`profiles.lang was not saved: ${error.message}`);
}
