import { PLACES, nearestPlace, type Place } from '@/lib/domain/places';
import { t } from '@/lib/i18n';

// 1° of latitude is 111 195 m on the haversine sphere, so 0.003507° ≈ 390 m and 0.003687° ≈ 410 m.
const north = (p: { lat: number; lng: number }, deg: number) => ({ lat: p.lat + deg, lng: p.lng });

it('names the closest spot: the stray dogs on the park jogging track', () => {
  expect(nearestPlace({ lat: 3.17841, lng: 101.51411 })?.label).toBe('place.joggingTrack');
});

it('picks the nearer of two places in range', () => {
  // The flood by the mall car park entrance: on Persiaran Tamarind, about 125 m from the mall itself.
  expect(nearestPlace({ lat: 3.18187, lng: 101.51114 })?.label).toBe('place.persiaranTamarind');
  expect(nearestPlace({ lat: 3.1813, lng: 101.5099 })?.label).toBe('place.mall');
});

it('is null when nothing is within 400 m', () => {
  expect(nearestPlace({ lat: 3.139, lng: 101.6869 })).toBeNull(); // Kuala Lumpur
});

it('counts 400 m as near and 410 m as not', () => {
  const only: Place[] = [{ label: 'place.mall', lat: 3.1814, lng: 101.5101 }];
  expect(nearestPlace(north(only[0], 0.003507), only)?.label).toBe('place.mall');
  expect(nearestPlace(north(only[0], 0.003687), only)).toBeNull();
});

it('keeps the list small and every name translated', () => {
  expect(PLACES.length).toBeGreaterThan(0);
  expect(PLACES.length).toBeLessThanOrEqual(10);
  for (const place of PLACES) {
    expect(t('en', place.label)).not.toBe(place.label);
    expect(t('ms', place.label)).not.toBe(place.label);
  }
});
