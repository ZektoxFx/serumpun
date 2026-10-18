import type { ParkingRate } from './malls';

// Pay parking (feedback round 2, spec §4.3) is a demo: there is no gate camera and no payment gateway. The entry time is
// pretend (stable for a day) and paying charges nothing. lib/parking.ts applies these rules on the server.

export const PAY_METHODS = ['duitnow_qr', 'fpx', 'apple_pay', 'google_pay'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

/** Plates kept per account; a sixth replaces the one used longest ago. */
export const MAX_PLATES = 5;

/** Upper case, anything but letters and digits as one space: "  wxy-1234 " is "WXY 1234". */
export function normalisePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/** A normalised plate: 2 to 10 letters and digits (spaces aside), with at least one letter and one digit. */
export function isValidPlate(plate: string): boolean {
  const bare = plate.replaceAll(' ', '');
  return /^[A-Z0-9]{2,10}$/.test(bare) && /[A-Z]/.test(bare) && /\d/.test(bare) && normalisePlate(plate) === plate;
}

/** How long the pretend car has been parked: 40 minutes to 4.5 hours, the same every time for the same seed (FNV-1a). */
export function pretendMinutes(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 40 + (hash % 231);
}

/** The fee by the started hour (the first block covers its hours or part of them), then the service tax on top. */
export function parkingFee(rate: ParkingRate, minutes: number): { feeSen: number; taxSen: number; totalSen: number } {
  const hours = Math.max(1, Math.ceil(minutes / 60));
  const feeSen = rate.firstSen + Math.max(0, hours - rate.firstHours) * rate.nextHourSen;
  const taxSen = Math.round(feeSen * rate.taxRate);
  return { feeSen, taxSen, totalSen: feeSen + taxSen };
}

export const formatRM = (sen: number) => `RM ${(sen / 100).toFixed(2)}`;

/** A short receipt reference from the session's id: "SRP-04213". */
export function parkingRef(id: string): string {
  return `SRP-${String(Number.parseInt(id.replaceAll('-', '').slice(0, 8), 16) % 100_000).padStart(5, '0')}`;
}
