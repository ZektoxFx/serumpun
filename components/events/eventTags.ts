import type { TagVariant } from '@/components/ui/Tag';
import type { PublicEvent } from '@/lib/domain/events';
import { t, type Lang } from '@/lib/i18n';

/** An event's tags: who runs it, always (Official · Sime Darby Property, or Resident event), then its points, if it gives any. */
export function eventTags(
  e: Pick<PublicEvent, 'is_official' | 'approval_status' | 'points'>,
  lang: Lang,
): { variant: TagVariant; text: string }[] {
  const points = eventPoints(e);
  return [
    e.is_official
      ? { variant: 'info', text: `🏢 ${t(lang, 'event.tag.official')}` }
      : { variant: 'purple', text: `👥 ${t(lang, 'event.tag.resident')}` },
    ...(points > 0 ? [{ variant: 'amber' as const, text: t(lang, 'event.tag.points', { n: points }) }] : []),
  ];
}

/** The points a check-in gives: the office's events always, a resident's once the office agreed. */
export function eventPoints(e: Pick<PublicEvent, 'is_official' | 'approval_status' | 'points'>): number {
  return e.is_official || e.approval_status === 'approved' ? e.points : 0;
}
