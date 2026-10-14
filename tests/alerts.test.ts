import {
  ALERT_TYPES,
  DEFAULT_FILTERS,
  DEFAULT_SEVERITY,
  ESCALATABLE,
  alertErrorKey,
  alertToReportCategory,
  escalationHref,
  filterAlerts,
  isAlertActive,
  isConfirmedHazard,
  isFresh,
  parseFilters,
  searchAlerts,
  type AlertType,
  type Severity,
} from '@/lib/domain/alerts';
import { REPORT_CATEGORIES } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';

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

// Task 6: the map's filters, search, freshness, escalation link and error messages.

it('filters default to everything, everywhere', () => {
  expect(DEFAULT_FILTERS).toEqual({ maxDistanceM: null, severities: ['high', 'medium', 'low'], types: [...ALERT_TYPES] });
});

it('reads saved filters back, and falls back to the default for anything broken', () => {
  const saved = { maxDistanceM: 1000, severities: ['high'], types: ['snake', 'police'] };
  expect(parseFilters(JSON.stringify(saved))).toEqual(saved);
  expect(parseFilters(null)).toEqual(DEFAULT_FILTERS); // nothing saved yet
  expect(parseFilters('{not json')).toEqual(DEFAULT_FILTERS);
  expect(parseFilters('"1 km"')).toEqual(DEFAULT_FILTERS);
  expect(parseFilters('[]')).toEqual(DEFAULT_FILTERS);
  // Field by field: a bad distance or list does not throw away the good parts.
  expect(parseFilters(JSON.stringify({ maxDistanceM: 750, severities: ['low', 'extreme', 'low'], types: 'snake' }))).toEqual({
    maxDistanceM: null,
    severities: ['low'],
    types: [...ALERT_TYPES],
  });
  // Unknown names (and prototype keys) are dropped; the canonical order is kept.
  expect(parseFilters(JSON.stringify({ maxDistanceM: 2000, severities: ['low', 'high'], types: ['police', '__proto__', 'snake'] }))).toEqual({
    maxDistanceM: 2000,
    severities: ['high', 'low'],
    types: ['snake', 'police'],
  });
});

it('keeps an empty selection: the resident turned every severity off', () => {
  expect(parseFilters(JSON.stringify({ maxDistanceM: null, severities: [], types: [] }))).toEqual({
    maxDistanceM: null,
    severities: [],
    types: [],
  });
});

const notes: { id: string; type: AlertType; note: string | null }[] = [
  { id: 'dogs', type: 'stray_dogs', note: 'Pack of 5 on the jogging track by the field.' },
  { id: 'snake', type: 'snake', note: 'Ular sawa dekat tasik.' },
  { id: 'light', type: 'streetlight', note: null },
];
const english = (type: AlertType) => ({ stray_dogs: 'Stray dogs', snake: 'Snake', streetlight: 'Streetlight out' })[type as string] ?? type;

it('searches the type label and the note, every word, any case', () => {
  const ids = (query: string) => searchAlerts(notes, query, english).map((a) => a.id);
  expect(ids('')).toEqual(['dogs', 'snake', 'light']);
  expect(ids('   ')).toEqual(['dogs', 'snake', 'light']);
  expect(ids('dogs')).toEqual(['dogs']); // the label
  expect(ids('TRACK')).toEqual(['dogs']); // the note
  expect(ids('stray field')).toEqual(['dogs']); // label and note together
  expect(ids('stray tasik')).toEqual([]); // every word must match the same alert
  expect(ids('out')).toEqual(['light']);
});

it('searches type labels in the reader’s language', () => {
  const malay = (type: AlertType) => t('ms', `alert.type.${type}`);
  expect(searchAlerts(notes, 'anjing', malay).map((a) => a.id)).toEqual(['dogs']);
  expect(searchAlerts(notes, 'anjing', english).map((a) => a.id)).toEqual([]);
});

it('a confirmation is fresh for 15 minutes', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  expect(isFresh({ confirm_count: 8, last_confirmed_at: '2026-10-13T09:58:00Z' }, now)).toBe(true);
  expect(isFresh({ confirm_count: 8, last_confirmed_at: '2026-10-13T09:45:00Z' }, now)).toBe(false);
  expect(isFresh({ confirm_count: 0, last_confirmed_at: '2026-10-13T09:59:00Z' }, now)).toBe(false); // only posted, never confirmed
});

it('links a lasting problem to a pre-filled report, and nothing else', () => {
  const alert = { id: 'a-1', lat: 3.176431, lng: 101.516284, is_official: false };
  expect(escalationHref({ ...alert, type: 'streetlight' })).toBe('/reports/new?category=streetlight&lat=3.17643&lng=101.51628&alert=a-1');
  expect(escalationHref({ ...alert, type: 'flood' })).toBe('/reports/new?category=drain&lat=3.17643&lng=101.51628&alert=a-1');
  expect(escalationHref({ ...alert, type: 'stray_dogs' })).toBeNull(); // passes by itself
  expect(escalationHref({ ...alert, type: 'flood', is_official: true })).toBeNull(); // the Management Office posted it
});

it('turns every RPC error code into a message in both languages', () => {
  const codes = {
    not_verified: 'common.pendingCantAct',
    bad_type: 'map.error.type',
    bad_severity: 'map.error.severity',
    out_of_area: 'map.error.outOfArea',
    bad_photo: 'map.error.photo',
    bad_vote: 'map.error.vote',
    not_found: 'map.error.notFound',
    own_alert: 'map.error.ownAlert',
    official_pin: 'map.error.officialPin',
    not_active: 'map.error.notActive',
    not_management: 'map.error.notManagement',
  };
  for (const [code, key] of Object.entries(codes)) {
    expect(alertErrorKey(code)).toBe(key);
    expect(t('en', alertErrorKey(code))).not.toBe(key);
    expect(t('ms', alertErrorKey(code))).not.toBe(key);
  }
  expect(alertErrorKey('duplicate key value violates unique constraint')).toBe('common.error');
  expect(alertErrorKey('__proto__')).toBe('common.error');
  expect(alertErrorKey(undefined)).toBe('common.error');
});

it('names every type and severity in both languages', () => {
  for (const type of ALERT_TYPES) {
    expect(t('en', `alert.type.${type}`)).not.toBe(`alert.type.${type}`);
    expect(t('ms', `alert.type.${type}`)).not.toBe(t('en', `alert.type.${type}`));
  }
  for (const level of ['high', 'medium', 'low'] as const) expect(t('ms', `severity.${level}`)).not.toBe(t('en', `severity.${level}`));
});
