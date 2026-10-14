import {
  ALERT_TYPES,
  DEFAULT_SEVERITY,
  ESCALATABLE,
  alertToReportCategory,
  filterAlerts,
  isAlertActive,
  isConfirmedHazard,
  type AlertType,
  type Severity,
} from '@/lib/domain/alerts';
import { REPORT_CATEGORIES } from '@/lib/domain/reports';

const centre = { lat: 3.1797, lng: 101.5156 };
// 0.0009° is about 100 m here, north or east; 0.0135° north is about 1.5 km.
const sample: { id: string; type: AlertType; severity: Severity; lat: number; lng: number }[] = [
  { id: 'a1', type: 'snake', severity: 'high', lat: 3.1806, lng: 101.5156 },
  { id: 'a2', type: 'police', severity: 'low', lat: 3.1797, lng: 101.5165 },
  { id: 'a3', type: 'stray_dogs', severity: 'medium', lat: 3.1932, lng: 101.5156 },
];

it('default severities match the spec', () => { expect(DEFAULT_SEVERITY.snake).toBe('high'); expect(DEFAULT_SEVERITY.stray_dogs).toBe('medium'); expect(DEFAULT_SEVERITY.police).toBe('low'); });
it('expired alerts are inactive, official pins never expire', () => { const now = new Date('2026-10-13T10:00:00Z');
  expect(isAlertActive({ status: 'active', is_official: false, expires_at: '2026-10-13T09:59:59Z' }, now)).toBe(false);
  expect(isAlertActive({ status: 'active', is_official: true, expires_at: '2026-10-13T09:00:00Z' }, now)).toBe(true);
  expect(isAlertActive({ status: 'cleared', is_official: true, expires_at: '2026-10-13T11:00:00Z' }, now)).toBe(false); });
it('filters by distance, severity and type', () => { /* 3 alerts: high@100m, low@100m, medium@1.5km */
  expect(filterAlerts(sample, { maxDistanceM: 1000, severities: ['high','medium'], types: [...ALERT_TYPES] }, centre).map(a => a.id)).toEqual(['a1']); });
it('only lasting problems escalate', () => { expect(alertToReportCategory('streetlight')).toBe('streetlight'); expect(alertToReportCategory('stray_dogs')).toBeNull(); });

// Beyond the brief.
it('an alert lives until the second it expires, as in public_alerts (expires_at > now())', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  expect(isAlertActive({ status: 'active', is_official: false, expires_at: '2026-10-13T10:00:00Z' }, now)).toBe(false);
  expect(isAlertActive({ status: 'active', is_official: false, expires_at: '2026-10-13T10:00:01+00:00' }, now)).toBe(true);
  expect(isAlertActive({ status: 'active', is_official: true, expires_at: null }, now)).toBe(true);
  expect(isAlertActive({ status: 'removed', is_official: true, expires_at: null }, now)).toBe(false);
});

it('drops the distance filter for "all of Elmina" or when the location is unknown', () => {
  const all = { maxDistanceM: null, severities: ['high', 'medium', 'low'] as Severity[], types: [...ALERT_TYPES] };
  expect(filterAlerts(sample, all, centre).map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  expect(filterAlerts(sample, { ...all, maxDistanceM: 500 }, null).map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  expect(filterAlerts(sample, { ...all, maxDistanceM: 500 }, centre).map((a) => a.id)).toEqual(['a1', 'a2']);
  expect(filterAlerts(sample, { ...all, types: ['police', 'stray_dogs'] }, centre).map((a) => a.id)).toEqual(['a2', 'a3']);
});

it('a hazard is confirmed by someone other than the poster, or official', () => {
  expect(isConfirmedHazard({ is_official: false, confirm_count: 0 })).toBe(false);
  expect(isConfirmedHazard({ is_official: false, confirm_count: 1 })).toBe(true);
  expect(isConfirmedHazard({ is_official: true, confirm_count: 0 })).toBe(true);
});

it('escalates exactly the lasting problems, each to a real report category', () => {
  expect([...ESCALATABLE].sort()).toEqual(['fallen_tree', 'flood', 'streetlight', 'walkway_blocked']);
  expect(ALERT_TYPES.filter((type) => alertToReportCategory(type) !== null).sort()).toEqual([...ESCALATABLE].sort());
  for (const type of ESCALATABLE) expect(REPORT_CATEGORIES).toContain(alertToReportCategory(type));
  expect([alertToReportCategory('fallen_tree'), alertToReportCategory('walkway_blocked'), alertToReportCategory('flood')]).toEqual(['tree', 'walkway', 'drain']);
});
