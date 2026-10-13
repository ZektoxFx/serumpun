import { greetingKey, mytDate, mytHour, startOfMytMonth, timeAgo } from '@/lib/domain/time';

it('mytDate uses Malaysia time', () => { expect(mytDate(new Date('2026-10-17T16:30:00Z'))).toBe('2026-10-18'); });
it('greeting at 07:00 MYT is morning', () => { expect(greetingKey(new Date('2026-10-12T23:00:00Z'))).toBe('morning'); });
it('timeAgo minutes EN/BM', () => { const now = new Date('2026-10-13T10:00:00Z'); const d = new Date('2026-10-13T09:48:00Z');
  expect(timeAgo(d, now, 'en')).toBe('12 min ago'); expect(timeAgo(d, now, 'ms')).toBe('12 min lalu'); });
it('startOfMytMonth', () => { expect(startOfMytMonth(new Date('2026-10-31T17:00:00Z')).toISOString()).toBe('2026-10-31T16:00:00.000Z'); });

// Beyond the brief: the edges where UTC and Malaysia time disagree.
it('the MYT day and hour turn over at 16:00 UTC', () => {
  expect(mytDate(new Date('2026-10-17T15:59:59Z'))).toBe('2026-10-17');
  expect(mytHour(new Date('2026-10-17T15:59:59Z'))).toBe(23);
  expect(mytHour(new Date('2026-10-17T16:00:00Z'))).toBe(0);
});

it('greeting boundaries follow MYT hours 05-11, 12-18, else evening', () => {
  const at = (utc: string) => greetingKey(new Date(utc));
  expect(at('2026-10-12T20:59:00Z')).toBe('evening'); // 04:59
  expect(at('2026-10-12T21:00:00Z')).toBe('morning'); // 05:00
  expect(at('2026-10-13T03:59:00Z')).toBe('morning'); // 11:59
  expect(at('2026-10-13T04:00:00Z')).toBe('afternoon'); // 12:00
  expect(at('2026-10-13T10:59:00Z')).toBe('afternoon'); // 18:59
  expect(at('2026-10-13T11:00:00Z')).toBe('evening'); // 19:00
});

it('timeAgo scales from just now to a calendar date', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const ago = (ms: number, lang: 'en' | 'ms') => timeAgo(new Date(now.getTime() - ms), now, lang);
  expect(ago(30_000, 'en')).toBe('just now');
  expect(ago(-60_000, 'ms')).toBe('baru sahaja'); // a clock a little ahead never says "in the future"
  expect(ago(3 * 3_600_000, 'en')).toBe('3 h ago');
  expect(ago(3 * 3_600_000, 'ms')).toBe('3 jam lalu');
  expect(ago(2 * 86_400_000, 'ms')).toBe('2 hari lalu');
  // Older than a week: the MYT calendar date (2026-10-03T17:00Z is 4 Oct, 01:00 MYT).
  expect(timeAgo(new Date('2026-10-03T17:00:00Z'), now, 'en')).toBe('4 Oct');
  expect(timeAgo(new Date('2026-10-03T17:00:00Z'), now, 'ms')).toBe('4 Okt');
  expect(timeAgo(new Date('2025-10-03T17:00:00Z'), now, 'en')).toBe('4 Oct 2025');
});

it('startOfMytMonth keeps an instant that is already midnight on the 1st', () => {
  expect(startOfMytMonth(new Date('2026-10-31T16:00:00Z')).toISOString()).toBe('2026-10-31T16:00:00.000Z');
  expect(startOfMytMonth(new Date('2026-10-31T15:59:59Z')).toISOString()).toBe('2026-09-30T16:00:00.000Z');
});
