import { initials } from '@/components/ui/Avatar';

it('takes the first letter of the first and last word', () => {
  expect(initials('Aisyah Rahman')).toBe('AR');
  expect(initials('  cikgu   farah  ')).toBe('CF');
  expect(initials('Tan Wei Ming')).toBe('TM');
});

it('copes with one word, no name and characters outside the BMP', () => {
  expect(initials('Madonna')).toBe('M');
  expect(initials('   ')).toBe('?');
  expect(initials('😀 Smile')).toBe('😀S');
});
