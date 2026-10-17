import type { MessageKey } from '@/lib/i18n';
import { distanceMeters, type LatLng } from './geo';

// supabase/migrations/0019_emergencies.sql keeps the same kinds.

/** Everyone whose neighbourhood is this close to an emergency is alerted (the feedback's 2 km), and the map shows it. */
export const ALERT_RADIUS_M = 2000;
/** How long a press of ＋ arms the emergency button. */
export const HOLD_MS = 3000;
/** An armed button that is not tapped goes back to ＋. */
export const ARMED_MS = 6000;

/** What the sender says it is, after sending; until then it is just an emergency. */
export const EMERGENCY_KINDS = ['fire', 'medical', 'crime', 'other'] as const;
export type EmergencyKind = (typeof EMERGENCY_KINDS)[number] | 'unknown';
export const EMERGENCY_ICON: Record<EmergencyKind, string> = { unknown: '🚨', fire: '🔥', medical: '🚑', crime: '🚔', other: '❗' };

/** A row of `public_emergencies`: a live emergency of the township, where and what, never who. */
export type PublicEmergency = { id: string; lat: number; lng: number; kind: EmergencyKind; created_at: string; is_mine: boolean };
export const PUBLIC_EMERGENCY_COLUMNS = 'id, lat, lng, kind, created_at, is_mine';

/**
 * Whether someone living at `home` (their neighbourhood's centre) is alerted. Unknown neighbourhoods are alerted too:
 * in an emergency, one alert too many beats one too few.
 */
export function withinAlertRadius(home: LatLng | null, emergency: LatLng): boolean {
  return home === null || distanceMeters(home, emergency) <= ALERT_RADIUS_M;
}

// The `raise exception` codes of the emergency RPCs.
const EMERGENCY_ERRORS: Record<string, MessageKey> = {
  not_verified: 'emergency.error.notVerified',
  bad_place: 'emergency.error.place',
  bad_kind: 'common.error',
  not_found: 'emergency.error.closed',
  not_allowed: 'emergency.error.notAllowed',
};

export function emergencyErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(EMERGENCY_ERRORS, code) ? EMERGENCY_ERRORS[code] : 'common.error';
}
