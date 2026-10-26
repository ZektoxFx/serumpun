import { leaseEnded } from '@/lib/card/decide';
// From core, not the index: the index brings React context, and this file is library code.
import type { MessageKey } from '@/lib/i18n/core';

export const UNIT_STATES = ['not_registered', 'code_given', 'active', 'suspended', 'lease_ended'] as const;
export type UnitState = (typeof UNIT_STATES)[number];

/**
 * What the office sees of a home's card. With no card, a home is "code given" while it has an open office code (`codeUntil`,
 * when it runs out), else not registered. A suspension shows before an ended lease (lifting it then shows the lease). A lease
 * runs to the end of its last day in Malaysia.
 */
export function unitState(
  unit: { lease_end: string | null; card: { status: 'active' | 'suspended' } | null; codeUntil: string | null },
  now: Date,
): UnitState {
  if (!unit.card) return unit.codeUntil ? 'code_given' : 'not_registered';
  if (unit.card.status === 'suspended') return 'suspended';
  return leaseEnded(unit.lease_end, now) ? 'lease_ended' : 'active';
}

// The `raise exception` codes of suspend_card, lift_card_suspension and give_unit_code, and `not_checked`, which the Give code action raises itself.
const UNIT_ERRORS: Record<string, MessageKey> = {
  not_management: 'units.error.not_management',
  not_found: 'units.error.not_found',
  bad_reason: 'units.error.bad_reason',
  not_suspended: 'units.error.not_suspended',
  bad_name: 'units.error.bad_name',
  bad_tenure: 'units.error.bad_tenure',
  bad_lease: 'units.error.bad_lease',
  has_card: 'units.error.has_card',
  not_checked: 'units.error.not_checked',
  bad_phone: 'phone.error.format',
};

/** What to tell the office whose Suspend, Lift or Give code failed. Anything unexpected is the generic error. */
export function unitErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(UNIT_ERRORS, code) ? UNIT_ERRORS[code] : 'common.error';
}
