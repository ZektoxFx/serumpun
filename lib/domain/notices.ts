import type { Lang, MessageKey } from '@/lib/i18n';
import { eventDay, mytDateTime } from './events';

// supabase/migrations/0018_notices.sql keeps the same kinds and limits.

/** What a resident tells the Management Office about ahead of time (Home › Notify office). */
export const NOTICE_KINDS = ['renovation', 'moving', 'event', 'contractor', 'other'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
export const NOTICE_ICON: Record<NoticeKind, string> = { renovation: '🔨', moving: '📦', event: '🎉', contractor: '🧰', other: '📝' };

/** A notice, as its resident and the office read it. */
export type ResidentNotice = {
  id: string;
  user_id: string;
  kind: NoticeKind;
  starts_on: string;
  ends_on: string;
  details: string;
  status: 'sent' | 'noted';
  reply: string | null;
  created_at: string;
  noted_at: string | null;
};
export const NOTICE_COLUMNS = 'id, user_id, kind, starts_on, ends_on, details, status, reply, created_at, noted_at';

/** "Sat, 17 Oct", or "Sat, 17 Oct – Wed, 21 Oct" for more than a day. */
export function noticeDates(startsOn: string, endsOn: string, lang: Lang): string {
  const day = (date: string) => eventDay(mytDateTime(date, '12:00')!, lang);
  return startsOn === endsOn ? day(startsOn) : `${day(startsOn)} – ${day(endsOn)}`;
}

// The `raise exception` codes of submit_notice and note_notice.
const NOTICE_ERRORS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  no_unit: 'notice.error.noUnit',
  bad_kind: 'notice.error.kind',
  bad_dates: 'notice.error.dates',
  bad_details: 'notice.error.details',
  not_management: 'notice.error.notManagement',
  not_found: 'notice.error.notFound',
};

export function noticeErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(NOTICE_ERRORS, code) ? NOTICE_ERRORS[code] : 'common.error';
}
