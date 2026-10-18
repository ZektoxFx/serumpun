import { HELP, faqMatches } from '@/lib/content/help';

describe('help content', () => {
  it('has the same shape in both languages', () => {
    for (const part of ['guidelines', 'rules', 'faq'] as const) expect(HELP.ms[part]).toHaveLength(HELP.en[part].length);
    expect(HELP.ms.terms.sections).toHaveLength(HELP.en.terms.sections.length);
    expect(HELP.en.faq.length).toBeGreaterThanOrEqual(10);
  });

  it('finds a question by words in the question or the answer, any case', () => {
    const item = { q: 'Who can see my unit number?', a: 'Only the Management Office.' };
    expect(faqMatches(item, 'UNIT')).toBe(true);
    expect(faqMatches(item, 'management')).toBe(true);
    expect(faqMatches(item, '  ')).toBe(true);
    expect(faqMatches(item, 'zzz')).toBe(false);
  });
});
