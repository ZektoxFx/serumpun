import { UNIT_STATES, unitErrorKey, unitState } from '@/lib/domain/units';
import { t } from '@/lib/i18n';

const now = new Date('2026-10-24T10:00:00Z');

it('calls a unit with no card not registered', () => expect(unitState({ lease_end: null, card: null, codeUntil: null }, now)).toBe('not_registered'));
it('calls a home with an open code and no card "code given"', () => {
  expect(unitState({ lease_end: null, card: null, codeUntil: '2026-10-27T09:00:00Z' }, now)).toBe('code_given');
  expect(unitState({ lease_end: null, card: { status: 'active' }, codeUntil: '2026-10-27T09:00:00Z' }, now)).toBe('active');
});
it('shows a suspension before a lease that has also ended', () =>
  expect(unitState({ lease_end: '2026-10-01', card: { status: 'suspended' }, codeUntil: null }, now)).toBe('suspended'));
it("shows a tenant's card as lease ended after the last day in Malaysia", () => {
  const unit = { lease_end: '2026-10-26', card: { status: 'active' as const }, codeUntil: null };
  expect(unitState(unit, new Date('2026-10-26T15:59:00Z'))).toBe('active');
  expect(unitState(unit, new Date('2026-10-26T16:00:00Z'))).toBe('lease_ended');
});
it('names every unit state and office error in both languages', () => {
  for (const state of UNIT_STATES) expect(t('ms', `units.state.${state}` as const)).not.toBe(t('en', `units.state.${state}` as const));
  for (const code of [
    'not_management', 'not_found', 'bad_reason', 'not_suspended',
    'bad_name', 'bad_tenure', 'bad_lease', 'has_card', 'not_checked', 'bad_phone',
  ]) {
    expect(unitErrorKey(code), code).not.toBe('common.error');
    expect(t('ms', unitErrorKey(code))).not.toBe(t('en', unitErrorKey(code)));
  }
  expect(unitErrorKey('bad_phone')).toBe('phone.error.format');
  expect(unitErrorKey('__proto__')).toBe('common.error');
});
