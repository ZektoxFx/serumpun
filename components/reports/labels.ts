import { fixTime, openDays } from '@/lib/domain/reports';
import { t, type Lang } from '@/lib/i18n';

/** "fixed in 6 hours" / "fixed in 2 days", from sending to the fix. */
export function fixedInLabel(lang: Lang, createdAt: string, resolvedAt: string): string {
  const { unit, n } = fixTime(createdAt, resolvedAt);
  if (unit === 'hours') return t(lang, n === 1 ? 'report.fixedHour' : 'report.fixedHours', { n });
  return t(lang, n === 1 ? 'report.fixedDay' : 'report.fixedDays', { n });
}

/** "opened today" / "open 2 days", in Malaysian calendar days. */
export function openLabel(lang: Lang, createdAt: string, now: Date): string {
  const n = openDays(createdAt, now);
  return n === 0 ? t(lang, 'report.openToday') : t(lang, n === 1 ? 'report.openDay' : 'report.openDays', { n });
}
