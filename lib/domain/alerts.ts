import type { MessageKey } from '@/lib/i18n';
import { distanceMeters, type LatLng } from './geo';
import type { ReportCategory } from './reports';

// supabase/migrations/0002_alerts.sql and 0004_dashboard.sql enforce the same types and three severities.
/** What residents can drop on the map. */
export const ALERT_TYPES = ['accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police'] as const;
/** Pins only the Management Office posts (spec §8.1: road works, water cuts). */
export const OFFICIAL_TYPES = ['road_works', 'water_cut'] as const;
/** Every type a pin on the map can have. */
export const PIN_TYPES = [...ALERT_TYPES, ...OFFICIAL_TYPES] as const;
export type AlertType = (typeof PIN_TYPES)[number];
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type AlertVote = 'still_there' | 'gone';

/** A row of the public_alerts view as the map reads it. The view never says who posted an alert. */
export type PublicAlert = {
  id: string;
  type: AlertType;
  severity: Severity;
  lat: number;
  lng: number;
  note: string | null;
  /** In the public `photos` bucket. */
  photo_path: string | null;
  is_official: boolean;
  status: string;
  confirm_count: number;
  gone_count: number;
  created_at: string;
  last_confirmed_at: string;
  expires_at: string | null;
  is_mine: boolean;
  my_vote: AlertVote | null;
};
export const PUBLIC_ALERT_COLUMNS =
  'id, type, severity, lat, lng, note, photo_path, is_official, status, confirm_count, gone_count, created_at, last_confirmed_at, expires_at, is_mine, my_vote';

/** Spec §8.1. The poster can change it. */
export const DEFAULT_SEVERITY: Record<AlertType, Severity> = {
  accident: 'high',
  snake: 'high',
  suspicious: 'high',
  stray_dogs: 'medium',
  flood: 'medium',
  fallen_tree: 'medium',
  walkway_blocked: 'medium',
  streetlight: 'low',
  police: 'low',
  road_works: 'low',
  water_cut: 'low',
};

/** The pin glyph per type. Where a report category covers the same thing, it uses the same icon. */
export const ALERT_ICON: Record<AlertType, string> = {
  accident: '💥',
  snake: '🐍',
  suspicious: '👤',
  stray_dogs: '🐕',
  flood: '🌊',
  fallen_tree: '🌳',
  walkway_blocked: '🚧',
  streetlight: '💡',
  police: '🚓',
  road_works: '🏗️',
  water_cut: '🚱',
};

/** The coloured dot next to a severity's name (canvas filter sheet). The name is always written next to it. */
export const SEVERITY_DOT: Record<Severity, string> = { high: '🔴', medium: '🟠', low: '🟡' };

/** Safe Walk keeps routes this far from a confirmed hazard. */
export const AVOID_RADIUS_M = 40;

const ESCALATE_TO: Partial<Record<AlertType, ReportCategory>> = {
  streetlight: 'streetlight',
  fallen_tree: 'tree',
  walkway_blocked: 'walkway',
  flood: 'drain',
};

/** Lasting problems: their alert sheet offers "Send to Management Office". */
export const ESCALATABLE: readonly AlertType[] = Object.keys(ESCALATE_TO) as AlertType[];

/** The report category a lasting problem becomes; null for passing ones (a snake moves on, a report would not help). */
export function alertToReportCategory(type: AlertType): ReportCategory | null {
  return Object.hasOwn(ESCALATE_TO, type) ? ESCALATE_TO[type]! : null;
}

/** Same rule as the public_alerts view: active, and either official or not yet expired. */
export function isAlertActive(a: { status: string; is_official: boolean; expires_at: string | null }, now: Date): boolean {
  return a.status === 'active' && (a.is_official || (a.expires_at !== null && Date.parse(a.expires_at) > now.getTime()));
}

/** vote_alert refuses the poster, so one "still there" means someone else saw it too. Official pins count as confirmed. */
export function isConfirmedHazard(a: { is_official: boolean; confirm_count: number }): boolean {
  return a.is_official || a.confirm_count >= 1;
}

/** A neighbour confirmed it in the last 15 minutes: the alert sheet shows "last confirmed" in green. */
export function isFresh(a: { confirm_count: number; last_confirmed_at: string }, now: Date): boolean {
  return a.confirm_count > 0 && now.getTime() - Date.parse(a.last_confirmed_at) < 15 * 60_000;
}

/** "Send to Management Office": a new report pre-filled from a lasting problem. Null for passing ones and official pins. */
export function escalationHref(a: { id: string; type: AlertType; lat: number; lng: number; is_official: boolean }): string | null {
  const category = alertToReportCategory(a.type);
  if (!category || a.is_official) return null;
  return `/reports/new?${new URLSearchParams({ category, lat: a.lat.toFixed(5), lng: a.lng.toFixed(5), alert: a.id })}`;
}

// The `raise exception` codes of create_alert, vote_alert, create_official_pin and remove_official_pin (0002_alerts.sql).
const ERROR_KEYS: Record<string, MessageKey> = {
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

/** What to tell the resident when an alert RPC fails (`error.message` is the code it raised). Anything else is generic. */
export function alertErrorKey(message: string | undefined): MessageKey {
  return message !== undefined && Object.hasOwn(ERROR_KEYS, message) ? ERROR_KEYS[message] : 'common.error';
}

export type AlertFilters = { maxDistanceM: number | null; severities: readonly Severity[]; types: readonly AlertType[] };

/** The distance choices; null is the whole township. */
export const DISTANCE_OPTIONS = [500, 1000, 2000, null] as const;

/** Everything, everywhere: a newcomer sees every alert in the township, official pins included. */
export const DEFAULT_FILTERS: AlertFilters = { maxDistanceM: null, severities: SEVERITIES, types: PIN_TYPES };

/**
 * The filters saved on this phone (localStorage), read back defensively: they are only as trustworthy as the browser
 * storage. Each field falls back to its default on its own; unknown names are dropped and the canonical order is kept.
 */
export function parseFilters(raw: string | null): AlertFilters {
  let saved: unknown;
  try {
    saved = JSON.parse(raw ?? '');
  } catch {
    return DEFAULT_FILTERS;
  }
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return DEFAULT_FILTERS;
  const { maxDistanceM, severities, types } = saved as Record<string, unknown>;
  const pick = <T extends string>(all: readonly T[], list: unknown): readonly T[] =>
    Array.isArray(list) ? all.filter((item) => list.includes(item)) : all;
  return {
    maxDistanceM: DISTANCE_OPTIONS.find((d) => d !== null && d === maxDistanceM) ?? null,
    severities: pick(SEVERITIES, severities),
    types: pick(PIN_TYPES, types),
  };
}

/** The top bar's search: every word of `query` must appear in the alert's type label (reader's language) or its note. */
export function searchAlerts<T extends { type: AlertType; note: string | null }>(
  alerts: readonly T[],
  query: string,
  label: (type: AlertType) => string,
): T[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return alerts.filter((a) => {
    const text = `${label(a.type)} ${a.note ?? ''}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** The map's filters. `maxDistanceM: null` is "all of Elmina"; with no location (`me` null) distance is not filtered. */
export function filterAlerts<T extends LatLng & { severity: Severity; type: AlertType }>(
  alerts: readonly T[],
  { maxDistanceM, severities, types }: AlertFilters,
  me: LatLng | null,
): T[] {
  return alerts.filter(
    (a) =>
      severities.includes(a.severity) &&
      types.includes(a.type) &&
      (maxDistanceM === null || me === null || distanceMeters(me, a) <= maxDistanceM),
  );
}
