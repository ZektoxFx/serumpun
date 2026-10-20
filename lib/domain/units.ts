import { leaseEnded } from '@/lib/card/decide';
// From core, not the index: the index brings React context, and this file is library code.
import type { MessageKey } from '@/lib/i18n/core';

export const UNIT_STATES = ['not_registered', 'active', 'suspended', 'lease_ended'] as const;
export type UnitState = (typeof UNIT_STATES)[number];

/**
 * What the office sees of a home's card. No card is not registered, and a suspension shows before an ended lease (lifting
 * it then shows the lease). A lease runs to the end of its last day in Malaysia.
 */
export function unitState(unit: { lease_end: string | null; card: { status: 'active' | 'suspended' } | null }, now: Date): UnitState {
  if (!unit.card) return 'not_registered';
  if (unit.card.status === 'suspended') return 'suspended';
  return leaseEnded(unit.lease_end, now) ? 'lease_ended' : 'active';
}

// The `raise exception` codes of suspend_card and lift_card_suspension.
const UNIT_ERRORS: Record<string, MessageKey> = {
  not_management: 'units.error.not_management',
  not_found: 'units.error.not_found',
  bad_reason: 'units.error.bad_reason',
  not_suspended: 'units.error.not_suspended',
};

/** What to tell the office whose Suspend or Lift failed. Anything unexpected is the generic error. */
export function unitErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(UNIT_ERRORS, code) ? UNIT_ERRORS[code] : 'common.error';
}
