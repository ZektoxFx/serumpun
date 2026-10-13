import { t, langFromAcceptLanguage } from '@/lib/i18n';
import en from '@/lib/i18n/en';
import ms from '@/lib/i18n/ms';

it('interpolates vars', () => { expect(t('en', 'home.greeting.morning', { name: 'Aisyah' })).toBe('Good morning, Aisyah'); });
it('translates to BM', () => { expect(t('ms', 'home.greeting.morning', { name: 'Aisyah' })).toBe('Selamat pagi, Aisyah'); });
it('every BM string is filled', () => { for (const k of Object.keys(en)) expect((ms as Record<string,string>)[k]?.trim()).toBeTruthy(); });
it('falls back to the key for unknown keys at runtime', () => { expect(t('en', 'nope.key' as never)).toBe('nope.key'); });

// Beyond the brief: guards for the places a later task is most likely to get wrong.
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();

it('leaves a placeholder visible when its var is missing instead of printing "undefined"', () => {
  expect(t('en', 'home.greeting.morning')).toBe('Good morning, {name}');
});

it('every BM string keeps the same {placeholders} as its English twin', () => {
  for (const k of Object.keys(en)) {
    expect(placeholders((ms as Record<string, string>)[k]), k).toBe(placeholders((en as Record<string, string>)[k]));
  }
});

it('picks BM only when Malay outranks English in Accept-Language', () => {
  expect(langFromAcceptLanguage('ms-MY,ms;q=0.9,en;q=0.8')).toBe('ms');
  expect(langFromAcceptLanguage('zh-CN,zh;q=0.9,ms;q=0.8,en;q=0.7')).toBe('ms');
  expect(langFromAcceptLanguage('en-MY,en;q=0.9,ms;q=0.8')).toBe('en');
});

it('defaults to English when Accept-Language is missing, empty or unsupported', () => {
  expect(langFromAcceptLanguage(null)).toBe('en');
  expect(langFromAcceptLanguage('')).toBe('en');
  expect(langFromAcceptLanguage('fr-FR,fr;q=0.9')).toBe('en');
});
