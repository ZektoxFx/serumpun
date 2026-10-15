import {
  ALERT_TYPES,
  DEFAULT_FILTERS,
  DEFAULT_SEVERITY,
  OFFICIAL_TYPES,
  PIN_TYPES,
  alertToReportCategory,
  escalationHref,
  parseFilters,
} from '@/lib/domain/alerts';
import { RESOLVED_SHOWN, groupForKanban, type ReportStatus } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';

const report = (id: string, status: ReportStatus, metoo_count: number, created_at: string) => ({ id, status, metoo_count, created_at });

describe('the dashboard kanban', () => {
  it('puts each status in its column: reopened is back under acknowledged, confirmed under resolved', () => {
    const columns = groupForKanban([
      report('a', 'submitted', 1, '2026-10-10T00:00:00Z'),
      report('b', 'reopened', 1, '2026-10-10T00:00:00Z'),
      report('c', 'acknowledged', 1, '2026-10-10T00:00:00Z'),
      report('d', 'in_progress', 1, '2026-10-10T00:00:00Z'),
      report('e', 'resolved', 1, '2026-10-10T00:00:00Z'),
      report('f', 'confirmed', 1, '2026-10-10T00:00:00Z'),
    ]);
    expect(Object.fromEntries(Object.entries(columns).map(([k, v]) => [k, v.map((r) => r.id).sort()]))).toEqual({
      new: ['a'],
      acknowledged: ['b', 'c'],
      in_progress: ['d'],
      resolved: ['e', 'f'],
    });
  });

  it('orders a column by Me too, then the longest waiting first', () => {
    const { new: column } = groupForKanban([
      report('quiet', 'submitted', 2, '2026-10-01T00:00:00Z'),
      report('newer', 'submitted', 6, '2026-10-12T00:00:00Z'),
      report('older', 'submitted', 6, '2026-10-11T00:00:00Z'),
      report('most', 'submitted', 27, '2026-10-13T00:00:00Z'),
    ]);
    expect(column.map((r) => r.id)).toEqual(['most', 'older', 'newer', 'quiet']);
  });

  it('keeps only the latest 20 resolved reports (25 in, 20 out), still ordered by Me too', () => {
    const resolved = Array.from({ length: 25 }, (_, i) =>
      report(`r${i}`, i % 2 ? 'resolved' : 'confirmed', i % 4, new Date(Date.UTC(2026, 9, 1 + i)).toISOString()),
    );
    const { resolved: column } = groupForKanban(resolved);
    expect(RESOLVED_SHOWN).toBe(20);
    expect(column).toHaveLength(20);
    expect(column.map((r) => r.id).sort()).toEqual(resolved.slice(5).map((r) => r.id).sort()); // the 5 oldest drop off
    for (let i = 1; i < column.length; i++) expect(column[i - 1].metoo_count).toBeGreaterThanOrEqual(column[i].metoo_count);
  });

  it('caps nothing but the resolved column', () => {
    const open = Array.from({ length: 30 }, (_, i) => report(`o${i}`, 'acknowledged', 0, new Date(Date.UTC(2026, 9, 1 + i)).toISOString()));
    expect(groupForKanban(open).acknowledged).toHaveLength(30);
  });
});

describe('official map pins', () => {
  it('have their own types, for the Management Office only, low by default and never sent back to it', () => {
    expect(OFFICIAL_TYPES).toEqual(['road_works', 'water_cut']);
    expect(PIN_TYPES).toEqual([...ALERT_TYPES, ...OFFICIAL_TYPES]);
    for (const type of OFFICIAL_TYPES) {
      expect(ALERT_TYPES).not.toContain(type); // the resident drop sheet lists ALERT_TYPES
      expect(DEFAULT_SEVERITY[type]).toBe('low');
      expect(alertToReportCategory(type)).toBeNull();
      expect(escalationHref({ id: 'p-1', type, lat: 3.18, lng: 101.51, is_official: true })).toBeNull();
      expect(t('en', `alert.type.${type}`)).not.toBe(`alert.type.${type}`);
      expect(t('ms', `alert.type.${type}`)).not.toBe(t('en', `alert.type.${type}`));
    }
  });

  it('show on the map unless the resident filters them out', () => {
    expect(DEFAULT_FILTERS.types).toEqual(PIN_TYPES);
    expect(parseFilters(JSON.stringify({ types: ['water_cut', 'snake'] })).types).toEqual(['snake', 'water_cut']);
  });
});
