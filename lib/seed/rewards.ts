import type { SupabaseClient } from '@supabase/supabase-js';
import { VOUCHER_DAYS, voucherCode, type RewardCategory } from '@/lib/domain/points';
import type { People } from './people';

const DAY = 86_400_000;

/** Spec §8.10: all at Elmina Lakeside Mall; the shop names are placeholders until partners are confirmed. */
const CATALOG: {
  key: string;
  partner: string;
  title: string;
  title_ms: string;
  category: RewardCategory;
  cost: number;
  terms?: [string, string];
  emoji: string;
}[] = [
  { key: 'kopi', partner: 'Lakeside Kopi', title: 'Free kopi', title_ms: 'Kopi percuma', category: 'food', cost: 250, emoji: '☕' },
  {
    key: 'groceries', partner: 'Elmina Grocer', title: 'RM10 off groceries', title_ms: 'Diskaun RM10 barangan runcit',
    category: 'groceries', cost: 500, terms: ['min spend RM50', 'belanja minimum RM50'], emoji: '🛒',
  },
  {
    key: 'playland', partner: 'Little Explorers', title: "1 hour at kids' playland", title_ms: '1 jam di taman permainan kanak-kanak',
    category: 'family', cost: 600, emoji: '🎠',
  },
  {
    key: 'sportswear', partner: 'Active Sports', title: 'RM15 off sportswear', title_ms: 'Diskaun RM15 pakaian sukan',
    category: 'sports', cost: 1500, terms: ['min spend RM80', 'belanja minimum RM80'], emoji: '👟',
  },
];

/** Aisyah's two active vouchers (−750 in all), redeemed `daysAgo` before `now`. */
const AISYAH_VOUCHERS = [
  { reward: 'kopi', daysAgo: 3 },
  { reward: 'groceries', daysAgo: 9 },
];

/** The catalog, and Aisyah's vouchers with the ledger rows that paid for them, as redeem_reward would leave them. */
export function rewardRows(now: Date, people: People) {
  const ids = Object.fromEntries(CATALOG.map((r) => [r.key, crypto.randomUUID()]));
  const rewards = CATALOG.map((r) => ({
    id: ids[r.key],
    township_id: people.townshipId,
    partner_name: r.partner,
    title: r.title,
    title_ms: r.title_ms,
    category: r.category,
    points_cost: r.cost,
    terms: r.terms?.[0] ?? null,
    terms_ms: r.terms?.[1] ?? null,
    emoji: r.emoji,
  }));
  const redemptions = [];
  const ledger = [];
  for (const v of AISYAH_VOUCHERS) {
    const id = crypto.randomUUID();
    const at = new Date(now.getTime() - v.daysAgo * DAY);
    redemptions.push({
      id,
      reward_id: ids[v.reward],
      user_id: people.ids.aisyah,
      code: voucherCode(),
      created_at: at.toISOString(),
      expires_at: new Date(at.getTime() + VOUCHER_DAYS * DAY).toISOString(),
    });
    ledger.push({ user_id: people.ids.aisyah, delta: -CATALOG.find((r) => r.key === v.reward)!.cost, reason: 'reward', ref_id: id, created_at: at.toISOString() });
  }
  return { rewards, redemptions, ledger };
}

/** The 4 rewards and Aisyah's 2 active vouchers. Runs after the events seed, which earned her the points. */
export async function seedRewards(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { rewards, redemptions, ledger } = rewardRows(now, people);
  const tables: [string, Record<string, unknown>[]][] = [
    ['rewards', rewards],
    ['redemptions', redemptions],
    ['points_ledger', ledger],
  ];
  for (const [table, rows] of tables) {
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`rewards: ${rewards.length} with ${redemptions.length} vouchers`);
}
