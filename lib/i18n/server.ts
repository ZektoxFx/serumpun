import { cookies, headers } from 'next/headers';
import { isLang, langFromAcceptLanguage, type Lang } from './core';

/** The visitor's language: the `lang` cookie if set, else their Accept-Language header, else English. */
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get('lang')?.value;
  return isLang(saved) ? saved : langFromAcceptLanguage((await headers()).get('accept-language'));
}
