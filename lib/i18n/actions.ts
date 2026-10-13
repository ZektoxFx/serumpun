'use server';

import { cookies } from 'next/headers';
import { isLang, type Lang } from './core';

/** Remembers the chosen language for a year. Setting a cookie re-renders the current page, now in that language. */
export async function setLang(lang: Lang) {
  if (!isLang(lang)) return; // it arrives from the browser
  (await cookies()).set('lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}
