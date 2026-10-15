import {
  REPORT_STATUSES,
  boardOrder,
  buildTimeline,
  canAnswerFix,
  canMeToo,
  fixTime,
  openDays,
  parsePrefill,
  reportErrorKey,
  type ReportStatus,
} from '@/lib/domain/reports';
import { t } from '@/lib/i18n';

it('names every code the report RPCs raise, in both languages', () => {
  const codes = [
    'not_verified', 'bad_category', 'bad_title', 'out_of_area', 'bad_photo', 'not_found', 'own_report', 'not_open',
    'not_management', 'bad_status', 'bad_team', 'bad_answer', 'not_affected', 'not_resolved',
  ];
  for (const code of codes) {
    const key = reportErrorKey(code);
    expect(key).not.toBe('common.error');
    expect(t('en', key)).not.toBe(key);
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(reportErrorKey('duplicate key value violates unique constraint')).toBe('common.error');
  expect(reportErrorKey('__proto__')).toBe('common.error');
  expect(reportErrorKey(undefined)).toBe('common.error');
});

it('names every category, status, step and team in both languages', () => {
  const keys = [
    ...['streetlight', 'road', 'tree', 'rubbish', 'drain', 'park', 'walkway', 'security', 'animals'].map((c) => `report.category.${c}`),
    ...REPORT_STATUSES.flatMap((s) => [`report.status.${s}`, `report.step.${s}`]),
    ...['facilities', 'roads', 'landscape', 'cleaning', 'security'].map((team) => `report.team.${team}`),
  ] as Parameters<typeof t>[1][];
  for (const key of keys) {
    expect(t('en', key)).not.toBe(key);
    expect(t('ms', key)).not.toBe(t('en', key));
  }
});

it('takes Me too only on open public reports of someone else', () => {
  const r = { is_private: false, is_mine: false, status: 'in_progress' as ReportStatus };
  expect(canMeToo(r)).toBe(true);
  expect(canMeToo({ ...r, status: 'reopened' })).toBe(true);
  expect(canMeToo({ ...r, is_private: true })).toBe(false);
  expect(canMeToo({ ...r, is_mine: true })).toBe(false);
  expect(canMeToo({ ...r, status: 'resolved' })).toBe(false);
  expect(canMeToo({ ...r, status: 'confirmed' })).toBe(false);
});

it('asks Fixed / Not fixed only of the reporter and Me-too neighbours, and only while resolved', () => {
  const r = { is_mine: false, has_metoo: true, status: 'resolved' as ReportStatus };
  expect(canAnswerFix(r)).toBe(true);
  expect(canAnswerFix({ ...r, has_metoo: false, is_mine: true })).toBe(true);
  expect(canAnswerFix({ ...r, has_metoo: false })).toBe(false);
  expect(canAnswerFix({ ...r, status: 'confirmed' })).toBe(false);
  expect(canAnswerFix({ ...r, status: 'in_progress' })).toBe(false);
});

it('counts open days in Malaysian calendar days', () => {
  const now = new Date('2026-10-20T01:00:00Z'); // 20 Oct, 09:00 MYT
  expect(openDays('2026-10-20T00:30:00Z', now)).toBe(0); // earlier this morning
  expect(openDays('2026-10-19T15:59:00Z', now)).toBe(1); // 19 Oct, 23:59 MYT: yesterday, though only 9 hours ago
  expect(openDays('2026-10-19T16:00:00Z', now)).toBe(0); // 20 Oct, 00:00 MYT: today
  expect(openDays('2026-10-18T02:00:00Z', now)).toBe(2);
});

it('says how long a fix took: hours within a day, then days', () => {
  expect(fixTime('2026-10-10T00:00:00Z', '2026-10-10T06:00:00Z')).toEqual({ unit: 'hours', n: 6 });
  expect(fixTime('2026-10-10T00:00:00Z', '2026-10-10T00:10:00Z')).toEqual({ unit: 'hours', n: 1 }); // never "0 hours"
  expect(fixTime('2026-10-10T00:00:00Z', '2026-10-10T23:40:00Z')).toEqual({ unit: 'days', n: 1 }); // 23.7 h rounds to a day
  expect(fixTime('2026-10-10T00:00:00Z', '2026-10-12T12:00:00Z')).toEqual({ unit: 'days', n: 3 }); // 2.5 days
});

const update = (status: ReportStatus, at: string, message: string | null = null, by_management = true) => ({
  status, created_at: at, message, photo_path: null, by_management,
});

describe('the timeline', () => {
  it('shows the steps so far, the current one, and the steps still to come (the #1042 story)', () => {
    const steps = buildTimeline('in_progress', [
      update('submitted', '2026-10-12T01:12:00Z', null, false),
      update('acknowledged', '2026-10-12T06:30:00Z'),
      update('in_progress', '2026-10-14T02:00:00Z', 'Contractor booked for Friday morning to replace the lamp.'),
    ]);
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ['submitted', 'done'],
      ['acknowledged', 'done'],
      ['in_progress', 'current'],
      ['resolved', 'next'],
      ['confirmed', 'next'],
    ]);
    expect(steps[2].notes).toEqual([
      { message: 'Contractor booked for Friday morning to replace the lamp.', photo_path: null, at: '2026-10-14T02:00:00Z', by_management: true },
    ]);
    expect(steps[3].at).toBeNull();
  });

  it('puts a message at the same step under that step instead of adding a step', () => {
    const steps = buildTimeline('acknowledged', [
      update('submitted', '2026-10-12T01:00:00Z', null, false),
      update('acknowledged', '2026-10-12T02:00:00Z'),
      update('acknowledged', '2026-10-13T02:00:00Z', 'Parts are on order.'),
    ]);
    expect(steps.map((s) => s.status)).toEqual(['submitted', 'acknowledged', 'in_progress', 'resolved', 'confirmed']);
    expect(steps[1].at).toBe('2026-10-12T02:00:00Z');
    expect(steps[1].notes.map((n) => n.message)).toEqual(['Parts are on order.']);
  });

  it('sorts the rows by time first', () => {
    const steps = buildTimeline('acknowledged', [
      update('acknowledged', '2026-10-12T02:00:00Z'),
      update('submitted', '2026-10-12T01:00:00Z', null, false),
    ]);
    expect(steps.slice(0, 2).map((s) => s.status)).toEqual(['submitted', 'acknowledged']);
  });

  it('keeps a reopen and the steps after it, with only the fix and the answer still to come', () => {
    const steps = buildTimeline('reopened', [
      update('submitted', '2026-10-01T00:00:00Z', null, false),
      update('acknowledged', '2026-10-01T06:00:00Z'),
      update('resolved', '2026-10-04T00:00:00Z', 'Drain cleared of leaves and silt.'),
      update('reopened', '2026-10-04T04:00:00Z', null, false),
    ]);
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ['submitted', 'done'],
      ['acknowledged', 'done'],
      ['resolved', 'done'],
      ['reopened', 'current'],
      ['resolved', 'next'],
      ['confirmed', 'next'],
    ]);
  });

  it('marks a confirmed report done from end to end, skipped steps left out', () => {
    const steps = buildTimeline('confirmed', [
      update('submitted', '2026-10-01T00:00:00Z', null, false),
      update('resolved', '2026-10-02T00:00:00Z', 'Lamp replaced.'),
      update('confirmed', '2026-10-02T05:00:00Z', null, false),
    ]);
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ['submitted', 'done'],
      ['resolved', 'done'],
      ['confirmed', 'done'],
    ]);
  });
});

it('orders the board: open reports by Me too (oldest first on a tie), then the latest fixes, capped', () => {
  const row = (id: string, status: ReportStatus, metoo_count: number, created_at: string, resolved_at: string | null = null) => ({
    id, status, metoo_count, created_at, resolved_at,
  });
  const rows = [
    row('fixedOld', 'confirmed', 30, '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
    row('branch', 'submitted', 3, '2026-10-14T00:00:00Z'),
    row('pothole', 'acknowledged', 27, '2026-10-13T00:00:00Z'),
    row('fixedNew', 'resolved', 9, '2026-10-10T00:00:00Z', '2026-10-12T00:00:00Z'),
    row('drainNew', 'reopened', 3, '2026-10-12T00:00:00Z'),
    row('drainOld', 'in_progress', 3, '2026-10-09T00:00:00Z'),
  ];
  expect(boardOrder(rows).map((r) => r.id)).toEqual(['pothole', 'drainOld', 'drainNew', 'branch', 'fixedNew', 'fixedOld']);
  expect(boardOrder(rows, 1).map((r) => r.id)).toEqual(['pothole', 'drainOld', 'drainNew', 'branch', 'fixedNew']);
});

describe('pre-filling a report from a map alert', () => {
  const alert = '3f0c9a52-1b7e-4c1d-9a3e-2b8f6d4e1a90';

  it('reads the category, place and alert', () => {
    expect(parsePrefill({ category: 'streetlight', lat: '3.17643', lng: '101.51628', alert })).toEqual({
      category: 'streetlight',
      at: { lat: 3.17643, lng: 101.51628 },
      alertId: alert,
    });
  });

  it('drops whatever is not a real category, place or alert id', () => {
    expect(parsePrefill({})).toEqual({ category: null, at: null, alertId: null });
    expect(parsePrefill({ category: 'toString', lat: '3.1', lng: 'abc', alert: 'x' })).toEqual({ category: null, at: null, alertId: null });
    expect(parsePrefill({ category: ['road', 'tree'], lat: '91', lng: '101.5', alert: `${alert}'` })).toEqual({ category: null, at: null, alertId: null });
    expect(parsePrefill({ lat: '3.1', lng: '' }).at).toBeNull(); // Number('') is 0
    expect(parsePrefill({ lat: 'Infinity', lng: '101.5' }).at).toBeNull();
  });
});
