import { distanceMeters, resolveStartLocation } from '@/lib/domain/geo';

const centre = { lat: 3.1797, lng: 101.5156 };
it('Central Park to Lakeside Mall ≈ 600 m', () => { const d = distanceMeters(centre, { lat: 3.18138, lng: 101.51009 }); expect(d).toBeGreaterThan(550); expect(d).toBeLessThan(700); });
it('falls back to centre when GPS missing', () => { expect(resolveStartLocation(null, centre)).toEqual(centre); });
it('falls back to centre when user is in KL (far away)', () => { expect(resolveStartLocation({ lat: 3.1390, lng: 101.6869 }, centre)).toEqual(centre); });
it('keeps a GPS fix inside Elmina', () => { const p = { lat: 3.181, lng: 101.512 }; expect(resolveStartLocation(p, centre)).toEqual(p); });

// Beyond the brief.
it('is zero for the same point and the same both ways', () => {
  const mall = { lat: 3.18138, lng: 101.51009 };
  expect(distanceMeters(centre, centre)).toBe(0);
  expect(distanceMeters(mall, centre)).toBeCloseTo(distanceMeters(centre, mall), 6);
});

it('honours a custom radius and refuses a broken fix', () => {
  const p = { lat: 3.181, lng: 101.512 }; // about 420 m from the centre
  expect(resolveStartLocation(p, centre, 0.4)).toEqual(centre);
  expect(resolveStartLocation(p, centre, 0.5)).toEqual(p);
  expect(resolveStartLocation({ lat: Number.NaN, lng: 101.512 }, centre)).toEqual(centre);
});
