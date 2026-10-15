import type { Lang, MessageKey } from '@/lib/i18n';
import { intlLocale } from './events';

// supabase/migrations/0006_rewards.sql enforces the same categories, code format and 30-day validity.

export const REWARD_CATEGORIES = ['food', 'groceries', 'family', 'sports'] as const;
export type RewardCategory = (typeof REWARD_CATEGORIES)[number];
export const REWARD_CATEGORY_ICON: Record<RewardCategory, string> = { food: '☕', groceries: '🛒', family: '👨‍👩‍👧', sports: '👟' };

/** A row of `rewards` as the screens read it. */
export type Reward = {
  id: string;
  partner_name: string;
  title: string;
  title_ms: string;
  category: RewardCategory;
  points_cost: number;
  terms: string | null;
  terms_ms: string | null;
  emoji: string;
};
export const REWARD_COLUMNS = 'id, partner_name, title, title_ms, category, points_cost, terms, terms_ms, emoji';

/** The reward's name in the reader's language (the catalog stores both). */
export const rewardTitle = (r: Pick<Reward, 'title' | 'title_ms'>, lang: Lang) => (lang === 'ms' ? r.title_ms : r.title);

/** "1,250": a points figure as the reader's language writes numbers. */
export const formatPoints = (n: number, lang: Lang) => n.toLocaleString(intlLocale(lang));

/** A voucher is valid this long after redeeming. */
export const VOUCHER_DAYS = 30;

/** A points balance: the sum of the ledger. */
export function balance(ledger: readonly { delta: number }[]): number {
  return ledger.reduce((sum, row) => sum + row.delta, 0);
}

/** The cheapest reward still out of reach, how far away it is, and the progress towards it (0–1). Null when none is. */
export function nextReward<R extends { id: string; points_cost: number }>(
  points: number,
  rewards: readonly R[],
): { reward: R; remaining: number; progress: number } | null {
  const reward = rewards
    .filter((r) => r.points_cost > points)
    .reduce<R | null>((cheapest, r) => (cheapest && cheapest.points_cost <= r.points_cost ? cheapest : r), null);
  return reward && { reward, remaining: reward.points_cost - points, progress: Math.max(0, points) / reward.points_cost };
}

/** No 0/O or 1/I: the cashier reads the code off a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** "ELM-7Q4K-2D". redeem_reward makes the real ones in SQL with the same alphabet; the seed uses this. */
export function voucherCode(rand: () => number = Math.random): string {
  const pick = () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  const chars = Array.from({ length: 6 }, pick).join('');
  return `ELM-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Expired from the very moment in `expiresAt` (use_voucher refuses it then too). */
export function isVoucherExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/** What a voucher shows: used once slid, expired once past its date (the table only stores active or used), else active. */
export function voucherState(v: { status: 'active' | 'used'; expires_at: string }, now: Date): 'active' | 'used' | 'expired' {
  if (v.status === 'used') return 'used';
  return isVoucherExpired(new Date(v.expires_at), now) ? 'expired' : 'active';
}

// The `raise exception` codes of redeem_reward and use_voucher.
const ERROR_KEYS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  not_found: 'reward.error.notFound',
  insufficient_points: 'reward.error.points',
  bad_request: 'reward.error.request',
  already_used: 'reward.error.used',
  expired: 'reward.error.expired',
};

export function rewardErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(ERROR_KEYS, code) ? ERROR_KEYS[code] : 'common.error';
}
