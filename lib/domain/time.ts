// From core, not the index: the index brings React context, which the seed script cannot load.
import { t, type Lang } from '@/lib/i18n/core';

/** Every "today", hour and month in Serumpun is Malaysia time. The servers run in UTC. */
export const TZ = 'Asia/Kuala_Lumpur';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// en-CA formats as YYYY-MM-DD; h23 keeps midnight at "00" (some engines print "24").
const mytFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

function mytParts(d: Date) {
  const parts: Record<string, string> = {};
  for (const { type, value } of mytFormat.formatToParts(d)) parts[type] = value;
  return parts;
}

/** The Malaysian calendar date of `d`, as YYYY-MM-DD. */
export function mytDate(d: Date): string {
  const { year, month, day } = mytParts(d);
  return `${year}-${month}-${day}`;
}

/** The Malaysian hour of `d`, 0 to 23. */
export function mytHour(d: Date): number {
  return Number(mytParts(d).hour);
}

/** Midnight at the start of `d`'s month in Malaysia. Malaysia has kept UTC+8 all year since 1982, so the offset is fixed. */
export function startOfMytMonth(d: Date): Date {
  return new Date(`${mytDate(d).slice(0, 8)}01T00:00:00+08:00`);
}

/** Which greeting fits: MYT 05:00-11:59 morning, 12:00-18:59 afternoon, otherwise evening. */
export function greetingKey(now: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = mytHour(now);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'evening';
}

/** "9:12 am" / "9:12 PG" in Malaysia time; on another day "12 Oct, 9:12 am", plus the year if it differs. */
export function clockTime(d: Date, now: Date, lang: Lang): string {
  const day = mytDate(d);
  const today = mytDate(now);
  return new Intl.DateTimeFormat(lang === 'ms' ? 'ms-MY' : 'en-MY', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    ...(day === today ? {} : { day: 'numeric', month: 'short', year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' }),
  }).format(d);
}

/** "12 min ago" / "12 min lalu". After a week it shows the MYT date instead ("4 Oct", plus the year if it differs). */
export function timeAgo(d: Date, now: Date, lang: Lang): string {
  const ms = now.getTime() - d.getTime();
  // Also covers a timestamp slightly in the future (another device's clock running ahead).
  if (ms < MINUTE) return t(lang, 'time.justNow');
  if (ms < HOUR) return t(lang, 'time.minutes', { n: Math.floor(ms / MINUTE) });
  if (ms < DAY) return t(lang, 'time.hours', { n: Math.floor(ms / HOUR) });
  if (ms < 7 * DAY) return t(lang, 'time.days', { n: Math.floor(ms / DAY) });
  const sameYear = mytDate(d).slice(0, 4) === mytDate(now).slice(0, 4);
  return new Intl.DateTimeFormat(lang === 'ms' ? 'ms-MY' : 'en-MY', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  }).format(d);
}
