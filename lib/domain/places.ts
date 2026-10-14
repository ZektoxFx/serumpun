import type { MessageKey } from '@/lib/i18n';
import { distanceMeters, type LatLng } from './geo';

export type Place = LatLng & { label: MessageKey };

/**
 * Named spots around City of Elmina, for the "Near …" line on an alert (Safe Walk reuses them in Task 20). Alerts have no
 * place column and nothing calls a geocoding service, so this short list is the only source of place names. The points
 * are the spec's park centre and mall, and the OpenStreetMap points behind lib/seed/alerts.ts.
 */
export const PLACES: readonly Place[] = [
  { label: 'place.centralPark', lat: 3.1797, lng: 101.5156 },
  { label: 'place.joggingTrack', lat: 3.17841, lng: 101.51411 },
  { label: 'place.carPark', lat: 3.18161, lng: 101.51588 },
  { label: 'place.mall', lat: 3.1814, lng: 101.5101 },
  { label: 'place.persiaranTamarind', lat: 3.18187, lng: 101.51114 },
  { label: 'place.persiaranElmina', lat: 3.18136, lng: 101.51555 },
  { label: 'place.persiaranGarcinia', lat: 3.17942, lng: 101.50514 },
  { label: 'place.valley3', lat: 3.17585, lng: 101.51665 },
];

/** Further than this, "near" would mislead. */
const NEAR_M = 400;

/** The closest named place within 400 m of `point`, or null when none is that close. */
export function nearestPlace(point: LatLng, places: readonly Place[] = PLACES): Place | null {
  let best: Place | null = null;
  let bestM = Infinity;
  for (const place of places) {
    const m = distanceMeters(point, place);
    if (m < bestM) {
      best = place;
      bestM = m;
    }
  }
  return bestM <= NEAR_M ? best : null;
}
