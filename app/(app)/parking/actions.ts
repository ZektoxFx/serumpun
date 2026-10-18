'use server';

import { findMall } from '@/lib/domain/malls';
import { PAY_METHODS, isValidPlate, normalisePlate, type PayMethod } from '@/lib/domain/parking';
import { isUuid } from '@/lib/domain/reports';
import type { MessageKey } from '@/lib/i18n';
import { checkParking, payParking, type ParkingQuote } from '@/lib/parking';
import { requireMember } from '@/lib/supabase/auth';

export type CheckResult = { ok: true; quote: ParkingQuote } | { ok: false; error: MessageKey };
export type PayResult = { ok: true; ref: string; exitBy: string; totalSen: number } | { ok: false; error: MessageKey };

/** "Check amount" for a plate at a mall. Any signed-in resident may (pending ones too: it is not posting). */
export async function checkParkingAction(mallSlug: string, rawPlate: string): Promise<CheckResult> {
  const profile = await requireMember();
  const mall = findMall(mallSlug);
  if (!mall) return { ok: false, error: 'common.error' };
  const plate = normalisePlate(String(rawPlate ?? ''));
  if (!isValidPlate(plate)) return { ok: false, error: 'parking.error.plate' };
  try {
    return { ok: true, quote: await checkParking(profile.id, mall, plate, new Date()) };
  } catch (error) {
    console.error(`check parking failed: ${error instanceof Error ? error.message : error}`);
    return { ok: false, error: 'common.error' };
  }
}

/** "Pay": the demo payment. Nothing is charged; the session is marked paid with the time left to exit. */
export async function payParkingAction(mallSlug: string, sessionId: string, method: string): Promise<PayResult> {
  const profile = await requireMember();
  const mall = findMall(mallSlug);
  if (!mall || !isUuid(sessionId) || !(PAY_METHODS as readonly string[]).includes(method)) return { ok: false, error: 'common.error' };
  try {
    const paid = await payParking(profile.id, mall, sessionId, method as PayMethod, new Date());
    return paid ? { ok: true, ...paid } : { ok: false, error: 'parking.error.alreadyPaid' };
  } catch (error) {
    console.error(`pay parking failed: ${error instanceof Error ? error.message : error}`);
    return { ok: false, error: 'common.error' };
  }
}
