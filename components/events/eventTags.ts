import type { TagVariant } from '@/components/ui/Tag';
import type { PublicEvent } from '@/lib/domain/events';
import { t, type Lang } from '@/lib/i18n';

/** An event's tags (canvas "Community › Events"): official, points, or a resident event (and whether points were asked). */
export function eventTags(
  e: Pick<PublicEvent, 'is_official' | 'approval_status' | 'points'>,
  lang: Lang,
): { variant: TagVariant; text: string }[] {
  if (e.is_official) {
    return [
      { variant: 'info', text: `🏢 ${t(lang, 'event.tag.official')}` },
      { variant: 'amber', text: t(lang, 'event.tag.points', { n: e.points }) },
    ];
  }
  if (e.approval_status === 'approved') return [{ variant: 'amber', text: t(lang, 'event.tag.approvedPoints', { n: e.points }) }];
  const resident = { variant: 'purple' as const, text: `👥 ${t(lang, 'event.tag.resident')}` };
  return e.approval_status === 'pending' ? [resident, { variant: 'info', text: `⏳ ${t(lang, 'event.tag.pending')}` }] : [resident];
}
