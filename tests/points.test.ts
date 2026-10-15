import {
  REWARD_CATEGORIES,
  VOUCHER_DAYS,
  balance,
  formatPoints,
  isVoucherExpired,
  nextReward,
  rewardErrorKey,
  voucherCode,
  voucherState,
} from '@/lib/domain/points';
import { t } from '@/lib/i18n';
import { eventRows } from '@/lib/seed/events';
import type { People } from '@/lib/seed/people';
import { rewardRows } from '@/lib/seed/rewards';

it('leaves Aisyah at exactly 1,250 points after all seeds, with two active vouchers (ruling R7)', () => {
  const now = new Date('2026-10-15T06:00:00Z');
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const earned = eventRows(now, people).ledger;
  const { rewards, redemptions, ledger: spent } = rewardRows(now, people);
  expect(balance([...earned, ...spent].filter((l) => l.user_id === 'aisyah'))).toBe(1250);
  expect(redemptions.filter((r) => r.user_id === 'aisyah' && !isVoucherExpired(new Date(r.expires_at), now))).toHaveLength(2);
  // Each voucher is paid for by one ledger row of its reward's price, as redeem_reward does it.
  for (const r of redemptions) {
    const paid = spent.filter((l) => l.ref_id === r.id);
    expect(paid.map((l) => l.delta)).toEqual([-rewards.find((x) => x.id === r.reward_id)!.points_cost]);
    expect(r.code).toMatch(/^ELM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
  }
  // The catalog of spec §8.10, and the next reward on Me: 250 more for the sportswear.
  expect(rewards.map((r) => r.points_cost)).toEqual([250, 500, 600, 1500]);
  expect(nextReward(1250, rewards)?.remaining).toBe(250);
});

it('balance sums ledger', () => {
  expect(balance([{ delta: 100 }, { delta: 150 }, { delta: -250 }])).toBe(0);
  expect(balance([])).toBe(0);
});

it('next reward is the cheapest one still out of reach', () => {
  const r = nextReward(1250, [{ id: 'kopi', points_cost: 250 }, { id: 'sport', points_cost: 1500 }, { id: 'groc', points_cost: 500 }]);
  expect(r?.reward.id).toBe('sport');
  expect(r?.remaining).toBe(250);
  expect(r?.progress).toBeCloseTo(0.833, 3);
});

it('has no next reward once everything is affordable', () => {
  expect(nextReward(2000, [{ id: 'kopi', points_cost: 250 }, { id: 'sport', points_cost: 1500 }])).toBeNull();
  expect(nextReward(100, [])).toBeNull();
});

it('voucher code format', () => {
  expect(voucherCode()).toMatch(/^ELM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
  // Every letter of the alphabet can come out (no 0/O or 1/I to misread at the till).
  expect(voucherCode(() => 0)).toBe('ELM-AAAA-AA');
  expect(voucherCode(() => 0.9999)).toBe('ELM-9999-99');
});

it('voucher expiry boundary', () => {
  const exp = new Date('2026-11-12T16:00:00Z');
  expect(isVoucherExpired(exp, new Date('2026-11-12T15:59:59Z'))).toBe(false);
  expect(isVoucherExpired(exp, exp)).toBe(true);
  expect(VOUCHER_DAYS).toBe(30);
});

it('voucher state: used wins, then the expiry date', () => {
  const now = new Date('2026-11-12T16:00:00Z');
  expect(voucherState({ status: 'active', expires_at: '2026-11-12T16:00:01Z' }, now)).toBe('active');
  expect(voucherState({ status: 'active', expires_at: '2026-11-12T16:00:00Z' }, now)).toBe('expired');
  expect(voucherState({ status: 'used', expires_at: '2026-11-01T00:00:00Z' }, now)).toBe('used');
});

it('formats points with thousands separators in both languages', () => {
  expect(formatPoints(1250, 'en')).toBe('1,250');
  expect(formatPoints(1250, 'ms')).toBe('1,250');
});

it('names every reward error and category in both languages', () => {
  for (const code of ['not_verified', 'not_found', 'insufficient_points', 'bad_request', 'already_used', 'expired']) {
    const key = rewardErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(rewardErrorKey('__proto__')).toBe('common.error');
  expect(rewardErrorKey(undefined)).toBe('common.error');
  for (const category of REWARD_CATEGORIES) {
    expect(t('en', `reward.category.${category}`)).not.toBe(`reward.category.${category}`);
    expect(t('ms', `reward.category.${category}`)).not.toBe(t('en', `reward.category.${category}`));
  }
});
