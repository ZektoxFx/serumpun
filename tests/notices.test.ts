import { NOTICE_KINDS, noticeDates, noticeErrorKey } from '@/lib/domain/notices';
import { mytDate } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { noticeRows } from '@/lib/seed/notices';
import type { People } from '@/lib/seed/people';

it('names every notice kind and error in both languages', () => {
  for (const kind of NOTICE_KINDS) {
    expect(t('en', `notice.kind.${kind}`)).not.toBe(`notice.kind.${kind}`);
    expect(t('ms', `notice.kind.${kind}`)).not.toBe(t('en', `notice.kind.${kind}`));
  }
  for (const code of ['not_verified', 'no_unit', 'bad_kind', 'bad_dates', 'bad_details', 'not_management', 'not_found']) {
    const key = noticeErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(noticeErrorKey('__proto__')).toBe('common.error');
});

it('shows one day, or the first and last day', () => {
  expect(noticeDates('2026-10-17', '2026-10-17', 'en')).toBe('Sat, 17 Oct');
  expect(noticeDates('2026-10-17', '2026-10-21', 'en')).toBe('Sat, 17 Oct – Wed, 21 Oct');
});

describe('the seeded notices', () => {
  const now = new Date('2026-10-16T06:00:00Z');
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const rows = noticeRows(now, people);

  it('keep the rules submit_notice and note_notice keep', () => {
    for (const n of rows) {
      expect(NOTICE_KINDS).toContain(n.kind);
      expect(n.starts_on >= mytDate(now), n.details).toBe(true);
      expect(n.ends_on >= n.starts_on).toBe(true);
      expect(n.details.length).toBeLessThanOrEqual(1000);
      expect(n.noted_at !== null).toBe(n.status === 'noted');
    }
  });

  it('give Aisyah a noted renovation with a reply, and the office two to note', () => {
    expect(rows.find((n) => n.user_id === 'aisyah')).toMatchObject({ kind: 'renovation', status: 'noted' });
    expect(rows.find((n) => n.user_id === 'aisyah')!.reply).toBeTruthy();
    expect(rows.filter((n) => n.status === 'sent')).toHaveLength(2);
  });
});
