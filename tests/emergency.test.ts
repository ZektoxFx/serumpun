import { ALERT_RADIUS_M, EMERGENCY_KINDS, emergencyErrorKey, withinAlertRadius } from '@/lib/domain/emergency';
import { distanceMeters } from '@/lib/domain/geo';
import { neighbourhoodCentre } from '@/lib/domain/places';
import { t } from '@/lib/i18n';

describe('who an emergency alerts', () => {
  const valley3 = neighbourhoodCentre('Elmina Valley 3')!;

  it('everyone living within 2 km, and nobody further', () => {
    expect(ALERT_RADIUS_M).toBe(2000);
    expect(withinAlertRadius(valley3, valley3)).toBe(true);
    const near = { lat: valley3.lat + 0.017, lng: valley3.lng }; // about 1.9 km north
    const far = { lat: valley3.lat + 0.019, lng: valley3.lng }; // about 2.1 km north
    expect(distanceMeters(valley3, near)).toBeLessThan(2000);
    expect(distanceMeters(valley3, far)).toBeGreaterThan(2000);
    expect(withinAlertRadius(valley3, near)).toBe(true);
    expect(withinAlertRadius(valley3, far)).toBe(false);
  });

  it('anyone whose neighbourhood the app cannot place: one alert too many beats one too few', () => {
    expect(withinAlertRadius(null, valley3)).toBe(true);
  });
});

it('names every emergency kind and error in both languages', () => {
  for (const kind of EMERGENCY_KINDS) {
    expect(t('en', `emergency.kind.${kind}`)).not.toBe(`emergency.kind.${kind}`);
    expect(t('ms', `emergency.kind.${kind}`)).not.toBe(t('en', `emergency.kind.${kind}`));
  }
  for (const code of ['not_verified', 'bad_place', 'not_found', 'not_allowed']) {
    const key = emergencyErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(emergencyErrorKey('__proto__')).toBe('common.error');
});
