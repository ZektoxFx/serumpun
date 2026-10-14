export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Where the map opens: the device's fix if it is within `maxKm` of the township centre, else the centre. No GPS, or a
 * visitor far away (a judge in KL), still lands on Elmina. A NaN fix fails the comparison and falls back too.
 */
export function resolveStartLocation(geo: LatLng | null, centre: LatLng, maxKm = 5): LatLng {
  return geo && distanceMeters(geo, centre) <= maxKm * 1000 ? geo : centre;
}
