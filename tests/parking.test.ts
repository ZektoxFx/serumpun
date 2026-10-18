import { findMall } from '@/lib/domain/malls';
import { formatRM, isValidPlate, normalisePlate, parkingFee, parkingRef, pretendMinutes } from '@/lib/domain/parking';

const elmina = findMall('elmina-lakeside-mall')!.rate;
const klEast = findMall('kl-east-mall')!.rate;

describe('pay parking', () => {
  it('normalises plates, however they are typed', () => {
    expect(normalisePlate('  wxy-1234 ')).toBe('WXY 1234');
    expect(normalisePlate('vbn   88')).toBe('VBN 88');
    expect(normalisePlate('wxy1234')).toBe('WXY1234');
  });

  it('checks plates: 2 to 10 letters and digits, with at least one of each', () => {
    for (const ok of ['WXY 1234', 'VBN 88', 'B 1234 X', 'WXY1234']) expect(isValidPlate(ok), ok).toBe(true);
    for (const bad of ['', 'A', '1234', 'ABCD', 'WXY 12345678', 'WXY_1']) expect(isValidPlate(bad), bad).toBe(false);
  });

  it('pretends a stay between 40 minutes and 4.5 hours that stays the same for the same seed', () => {
    const seed = 'u|elmina-lakeside-mall|WXY 1234|2026-10-18';
    expect(pretendMinutes(seed)).toBe(pretendMinutes(seed));
    for (let i = 0; i < 200; i++) {
      const minutes = pretendMinutes(`seed-${i}`);
      expect(minutes).toBeGreaterThanOrEqual(40);
      expect(minutes).toBeLessThanOrEqual(270);
    }
  });

  it('charges by the started hour, with the service tax on top', () => {
    expect(parkingFee(elmina, 1).totalSen).toBe(200);
    expect(parkingFee(elmina, 120).totalSen).toBe(200);
    expect(parkingFee(elmina, 121).totalSen).toBe(300);
    expect(parkingFee(elmina, 181).totalSen).toBe(400);
    expect(parkingFee(klEast, 60)).toEqual({ feeSen: 200, taxSen: 16, totalSen: 216 });
    expect(parkingFee(klEast, 135)).toEqual({ feeSen: 400, taxSen: 32, totalSen: 432 });
  });

  it('formats ringgit and receipt references', () => {
    expect(formatRM(300)).toBe('RM 3.00');
    expect(formatRM(216)).toBe('RM 2.16');
    expect(parkingRef('3f0c9a52-1b7e-4c1d-9a3e-2b8f6d4e1a90')).toMatch(/^SRP-\d{5}$/);
  });
});
