import en from './en';
import ms from './ms';

export type Lang = 'en' | 'ms';
export type MessageKey = keyof typeof en;
export type Vars = Record<string, string | number>;

const messages: Record<Lang, Record<string, string | undefined>> = { en, ms };

export const isLang = (value: unknown): value is Lang => value === 'en' || value === 'ms';

/** Translates `key`, filling `{name}` placeholders from `vars`. A key nobody defined comes back as itself. */
export function t(lang: Lang, key: MessageKey, vars?: Vars): string {
  const message = messages[lang][key] ?? messages.en[key] ?? key;
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (hole, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : hole));
}

/**
 * The visitor's language from an Accept-Language header: the supported language they rank highest
 * ("en-MY,en;q=0.9,ms;q=0.8" is English; the spec says Malay only when the phone's language is Malay).
 * English when nothing matches.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  let best: Lang = 'en';
  let bestQ = 0;
  for (const part of (header ?? '').split(',')) {
    const [tag, ...params] = part.split(';');
    const lang = tag.trim().toLowerCase().split('-')[0];
    const q = Number(params.map((p) => p.trim()).find((p) => p.startsWith('q='))?.slice(2) ?? 1);
    if (isLang(lang) && q > bestQ) {
      best = lang;
      bestQ = q;
    }
  }
  return best;
}
