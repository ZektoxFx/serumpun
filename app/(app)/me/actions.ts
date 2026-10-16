'use server';

import { cookies } from 'next/headers';
import { isTextSize, type TextSize } from '@/lib/textSize';

/** Remembers Me › Text size on this device for a year; setting the cookie re-renders the page at that size. */
export async function setTextSize(size: TextSize) {
  if (!isTextSize(size)) return; // it arrives from the browser
  (await cookies()).set('textSize', size, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}
