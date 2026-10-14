import { distanceMeters, type LatLng } from './geo';
import type { ReportCategory } from './reports';

// The same nine types, three severities and statuses are enforced by checks in supabase/migrations/0002_alerts.sql.
export const ALERT_TYPES = ['accident', 'snake', 'suspicious', 'stray_dogs', 'flood', 'fallen_tree', 'walkway_blocked', 'streetlight', 'police'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type Severity = 'high' | 'medium' | 'low';

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
};

/** Safe Walk keeps routes this far from a confirmed hazard. */
export const AVOID_RADIUS_M = 40;

const ESCALATE_TO: Partial<Record<AlertType, ReportCategory>> = {
  streetlight: 'streetlight',
  fallen_tree: 'tree',
  walkway_blocked: 'walkway',
  flood: 'drain',
};

/** Lasting problems: their alert sheet offers "Send to Management Office". */
export const ESCALATABLE = Object.keys(ESCALATE_TO) as AlertType[];

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

export type AlertFilters = { maxDistanceM: number | null; severities: readonly Severity[]; types: readonly AlertType[] };

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
