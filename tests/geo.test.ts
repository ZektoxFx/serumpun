import { distanceMeters, formatDistance, resolveStartLocation } from '@/lib/domain/geo';

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

it('formats distances: tens of metres below a kilometre, tenths of a kilometre above', () => {
  expect(formatDistance(83)).toBe('80 m');
  expect(formatDistance(500)).toBe('500 m');
  expect(formatDistance(994)).toBe('990 m');
  expect(formatDistance(995)).toBe('1 km'); // never "1000 m"
  expect(formatDistance(1000)).toBe('1 km');
  expect(formatDistance(1234)).toBe('1.2 km');
  expect(formatDistance(2000)).toBe('2 km');
  expect(formatDistance(0)).toBe('10 m'); // standing on it still reads as a distance
});
