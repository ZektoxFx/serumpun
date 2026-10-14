import { MANAGEMENT_NEXT, REPORT_CATEGORIES, REPORT_STATUSES, hotIds, kanbanColumn, scorecard, shouldReopen } from '@/lib/domain/reports';
import { REPORTS, reportRows } from '@/lib/seed/reports';
import type { People } from '@/lib/seed/people';

it('kanban columns', () => { expect(kanbanColumn('submitted')).toBe('new'); expect(kanbanColumn('reopened')).toBe('acknowledged'); expect(kanbanColumn('confirmed')).toBe('resolved'); });
it('management cannot move a resolved report', () => { expect(MANAGEMENT_NEXT.resolved).toEqual([]); expect(MANAGEMENT_NEXT.submitted).toContain('acknowledged'); });
it('scorecard counts this MYT month only and averages days to fix', () => {
  const now = new Date('2026-10-20T04:00:00Z');
  const rows = [ { created_at: '2026-10-10T00:00:00Z', resolved_at: '2026-10-12T12:00:00Z', fixed_yes: 3, fixed_no: 1 },
                 { created_at: '2026-09-28T00:00:00Z', resolved_at: '2026-09-30T15:59:00Z', fixed_yes: 1, fixed_no: 0 },   // 30 Sep 23:59 MYT → last month
                 { created_at: '2026-10-15T00:00:00Z', resolved_at: null, fixed_yes: 0, fixed_no: 0 } ];
  expect(scorecard(rows, now)).toEqual({ resolvedThisMonth: 1, avgDaysToFix: 2.5, pctSaidFixed: 80 }); });
it('reopen rules', () => { expect(shouldReopen([{ byReporter: true, fixed: false }])).toBe(true);
  expect(shouldReopen([{ byReporter: false, fixed: false }])).toBe(false);
  expect(shouldReopen([{ byReporter: false, fixed: false }, { byReporter: false, fixed: false }])).toBe(true); });
it('hot reports', () => { expect([...hotIds([{ id: 'a', metoo_count: 27 }, { id: 'b', metoo_count: 13 }, { id: 'c', metoo_count: 21 }])].sort()).toEqual(['a','c']); });

// Beyond the brief.
it('an empty board has no averages', () => {
  expect(scorecard([], new Date('2026-10-20T04:00:00Z'))).toEqual({ resolvedThisMonth: 0, avgDaysToFix: null, pctSaidFixed: null });
});

it('the Management Office never sets submitted, confirmed or reopened: residents do', () => {
  for (const status of REPORT_STATUSES) {
    for (const next of MANAGEMENT_NEXT[status]) expect(['acknowledged', 'in_progress', 'resolved']).toContain(next);
  }
});

it('a reporter who says fixed, or one neighbour who says not fixed, does not reopen', () => {
  expect(shouldReopen([{ byReporter: true, fixed: true }, { byReporter: false, fixed: false }])).toBe(false);
  expect(shouldReopen([])).toBe(false);
});

it('the most-supported open report is hot even below 20; nothing is hot with no Me too', () => {
  expect([...hotIds([{ id: 'a', metoo_count: 4 }, { id: 'b', metoo_count: 7 }])]).toEqual(['b']);
  expect(hotIds([{ id: 'a', metoo_count: 0 }]).size).toBe(0);
});

// The seed: any key works as a person id here.
const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;

describe('seeded reports', () => {
  const now = new Date('2026-10-15T02:00:00Z');
  let rows: ReturnType<typeof reportRows>;
  beforeAll(() => {
    rows = reportRows(now, people);
  });

  it('pin the streetlight to #1042: it is inserted 42nd and numbers start at 1001', () => {
    const { reports } = rows;
    expect(reports[41].title).toBe('Streetlight not working');
    expect(reports[41].created_by).toBe('aisyah');
  });

  it('cover every status and category in 15 detailed reports, two of them private', () => {
    expect(REPORTS).toHaveLength(15);
    expect(new Set(REPORTS.map((r) => r.status))).toEqual(new Set(REPORT_STATUSES));
    expect(new Set(REPORTS.map((r) => r.category))).toEqual(new Set(REPORT_CATEGORIES));
    expect(REPORTS.filter((r) => r.private)).toHaveLength(2);
  });

  it('only hold Me toos and answers the RPCs would have accepted', () => {
    const { reports, metoo, confirmations } = rows;
    const byId = new Map(reports.map((r) => [r.id, r]));
    const seen = new Set<string>();
    for (const m of metoo) {
      const r = byId.get(m.report_id)!;
      expect(r.is_private).toBe(false);
      expect(m.user_id).not.toBe(r.created_by);
      expect(seen.has(`${m.report_id}/${m.user_id}`)).toBe(false);
      seen.add(`${m.report_id}/${m.user_id}`);
    }
    for (const r of reports) expect(r.metoo_count).toBeGreaterThanOrEqual(metoo.filter((m) => m.report_id === r.id).length);
    for (const c of confirmations) {
      const r = byId.get(c.report_id)!;
      expect(c.user_id === r.created_by || seen.has(`${c.report_id}/${c.user_id}`)).toBe(true);
      if (c.user_id === r.created_by) expect(r.status).toBe(c.fixed ? 'confirmed' : 'reopened');
    }
    for (const r of reports) expect(r.resolved_at === null).toBe(['submitted', 'acknowledged', 'in_progress', 'reopened'].includes(r.status));
  });

  it('happen in the past, each report after its own creation', () => {
    const { reports, metoo, updates, confirmations } = rows;
    const created = new Map(reports.map((r) => [r.id, Date.parse(r.created_at)]));
    for (const row of [...reports, ...updates, ...metoo, ...confirmations]) {
      const at = Date.parse('report_id' in row ? row.created_at : row.updated_at);
      expect(at).toBeLessThanOrEqual(now.getTime());
      expect(at).toBeGreaterThanOrEqual(created.get('report_id' in row ? row.report_id : row.id)!);
    }
  });
});

// The four detailed fixes (20, 30, 44 and 48 hours old) join the month's bulk one by one during its first two days.
it.each([
  '2026-10-31T16:30:00Z', // 1 Nov, 00:30 in Malaysia: the month is 30 minutes old
  '2026-11-01T14:00:00Z', // 1 Nov, 22:00: one detailed fix in this month
  '2026-11-02T04:00:00Z', // two
  '2026-11-02T13:00:00Z', // three
  '2026-10-15T02:00:00Z',
  '2026-10-31T15:30:00Z', // 31 Oct, 23:30
])('the seeded board scores about 48 resolved, 2.4 days and 92 percent fixed on any day (now = %s)', (iso) => {
  const now = new Date(iso);
  const { reports, confirmations } = reportRows(now, people);
  // What a resident's board sees: the public reports, with the counts public_reports adds.
  const board = reports.filter((r) => !r.is_private).map((r) => ({
    ...r,
    fixed_yes: confirmations.filter((c) => c.report_id === r.id && c.fixed).length,
    fixed_no: confirmations.filter((c) => c.report_id === r.id && !c.fixed).length,
  }));
  const score = scorecard(board, now);
  expect(score.resolvedThisMonth).toBeGreaterThanOrEqual(44);
  expect(score.resolvedThisMonth).toBeLessThanOrEqual(48);
  expect(score.avgDaysToFix).toBe(2.4);
  expect(score.pctSaidFixed).toBeGreaterThanOrEqual(91);
  expect(score.pctSaidFixed).toBeLessThanOrEqual(93);
});
