import { HELP, faqMatches } from '@/lib/content/help';
import { t } from '@/lib/i18n';

describe('help content', () => {
  it('has the same shape in both languages', () => {
    for (const part of ['guidelines', 'rules', 'faq'] as const) expect(HELP.ms[part]).toHaveLength(HELP.en[part].length);
    expect(HELP.ms.terms.sections).toHaveLength(HELP.en.terms.sections.length);
    expect(HELP.en.faq.length).toBeGreaterThanOrEqual(10);
  });

  // Stage 2: nobody signs up and waits for approval any more. They get a code at the counter and register with it.
  it('says how to join, in both languages, naming the button it starts from', () => {
    const at = HELP.en.faq.findIndex((item) => item.q === 'How do I join Serumpun?');
    expect(at).toBeGreaterThanOrEqual(0);
    for (const lang of ['en', 'ms'] as const) {
      const { a } = HELP[lang].faq[at];
      for (const word of ['IC', 'PIN', t(lang, 'landing.register')]) expect(a, `${lang}: ${word}`).toContain(word);
    }
    expect(HELP.en.faq.map((item) => item.q)).not.toContain("Why can't I post yet?");
  });

  it('describes the counter check and the code in the terms, and keeps a PIN, not a password', () => {
    const account = HELP.en.terms.sections.findIndex((section) => section.title === 'Your account and verification');
    expect(account).toBeGreaterThanOrEqual(0);
    for (const lang of ['en', 'ms'] as const) {
      const text = HELP[lang].terms.sections[account].steps.join(' ');
      for (const word of ['IC', 'PIN', 'SMS']) expect(text, `${lang}: ${word}`).toContain(word);
      expect(text, lang).toMatch(lang === 'en' ? /3 days/ : /3 hari/);
    }
    expect(JSON.stringify(HELP)).not.toMatch(/password|kata laluan/i);
  });

  it('finds a question by words in the question or the answer, any case', () => {
    const item = { q: 'Who can see my unit number?', a: 'Only the Management Office.' };
    expect(faqMatches(item, 'UNIT')).toBe(true);
    expect(faqMatches(item, 'management')).toBe(true);
    expect(faqMatches(item, '  ')).toBe(true);
    expect(faqMatches(item, 'zzz')).toBe(false);
  });
});
