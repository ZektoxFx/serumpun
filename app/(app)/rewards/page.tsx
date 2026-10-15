import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { RedeemButton } from '@/components/rewards/RedeemButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import { eventDay, eventTime } from '@/lib/domain/events';
import {
  REWARD_CATEGORIES,
  REWARD_CATEGORY_ICON,
  REWARD_COLUMNS,
  formatPoints,
  rewardTitle,
  voucherState,
  type Reward,
} from '@/lib/domain/points';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'reward.title') };
}

type Voucher = {
  id: string;
  code: string;
  status: 'active' | 'used';
  expires_at: string;
  used_at: string | null;
  reward: Pick<Reward, 'title' | 'title_ms' | 'emoji'>;
};

/**
 * Rewards (canvas "Me & Rewards"): the balance, how to earn, the catalog by category with Redeem or "N more", and the
 * resident's own vouchers (`?view=mine`, the "My vouchers" row on Me).
 */
export default async function RewardsPage({ searchParams }: PageProps<'/rewards'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const params = await searchParams;
  const mine = params.view === 'mine';
  const cat = REWARD_CATEGORIES.find((c) => c === params.cat) ?? null;
  const supabase = await createClient();
  const [catalog, points, vouchers] = await Promise.all([
    supabase.from('rewards').select(REWARD_COLUMNS).eq('active', true).order('points_cost').overrideTypes<Reward[], { merge: false }>(),
    supabase.rpc('my_points'),
    supabase
      .from('redemptions')
      .select('id, code, status, expires_at, used_at, reward:rewards(title, title_ms, emoji)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .overrideTypes<Voucher[], { merge: false }>(),
  ]);
  for (const { error } of [catalog, points, vouchers]) if (error) throw new Error(`rewards lookup failed: ${error.message}`);
  const balance = Number(points.data ?? 0);
  const now = new Date();
  const shown = catalog.data!.filter((r) => cat === null || r.category === cat);

  const segment = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${on ? 'bg-surface text-text shadow-card' : 'text-muted-2'}`;
  const chip = (on: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-4 text-sm font-bold ${
      on ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-text'
    }`;

  return (
    <>
      <AppHeader title={t(lang, 'reward.title')} back="/me">
        <p className="mt-2 inline-flex rounded-full bg-tint-amber px-3 py-1 text-sm font-extrabold text-amber-text">
          <span aria-hidden="true">★&nbsp;</span>
          {t(lang, 'reward.balance', { n: formatPoints(balance, lang) })}
        </p>
      </AppHeader>
      <main className="grid gap-3 px-4 py-4">
        <nav aria-label={t(lang, 'reward.views')} className="flex rounded-xl bg-chip p-1">
          <Link href="/rewards" aria-current={mine ? undefined : 'page'} className={segment(!mine)}>
            {t(lang, 'reward.catalog')}
          </Link>
          <Link href="/rewards?view=mine" aria-current={mine ? 'page' : undefined} className={segment(mine)}>
            {t(lang, 'reward.mine', { n: vouchers.data!.filter((v) => voucherState(v, now) === 'active').length })}
          </Link>
        </nav>

        {mine ? (
          vouchers.data!.length === 0 ? (
            <EmptyState icon="🎟️" title={t(lang, 'reward.mine.empty')} description={t(lang, 'reward.mine.emptyHint')} />
          ) : (
            <ul className="grid gap-2">
              {vouchers.data!.map((v) => {
                const state = voucherState(v, now);
                return (
                  <li key={v.id}>
                    <Link href={`/rewards/${v.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card hover:bg-soft">
                      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-orange text-2xl">
                        {v.reward.emoji}
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="break-words font-bold">{rewardTitle(v.reward, lang)}</span>
                        <span className="text-sm tracking-wider text-muted-2">{v.code}</span>
                        <span className="text-xs text-muted-2">
                          {state === 'used'
                            ? t(lang, 'reward.usedAt', { time: `${eventDay(new Date(v.used_at!), lang)} · ${eventTime(new Date(v.used_at!), lang)}` })
                            : t(lang, state === 'active' ? 'reward.validUntil' : 'reward.expired', { date: eventDay(new Date(v.expires_at), lang) })}
                        </span>
                      </span>
                      <Tag variant={state === 'active' ? 'green' : 'info'}>{t(lang, `reward.status.${state}`)}</Tag>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <>
            <p className="rounded-xl bg-tint-blue px-3 py-2.5 text-sm">
              <span aria-hidden="true">📅</span> {t(lang, 'reward.earn')}
            </p>
            <nav aria-label={t(lang, 'reward.categories')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              <Link href="/rewards" aria-current={cat === null ? 'page' : undefined} className={chip(cat === null)}>
                {t(lang, 'event.all')}
              </Link>
              {REWARD_CATEGORIES.map((c) => (
                <Link key={c} href={`/rewards?cat=${c}`} aria-current={cat === c ? 'page' : undefined} className={chip(cat === c)}>
                  <span aria-hidden="true">{REWARD_CATEGORY_ICON[c]}</span> {t(lang, `reward.category.${c}`)}
                </Link>
              ))}
            </nav>
            <h2 className="pt-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t(lang, 'reward.at')}</h2>
            <ul className="grid gap-2">
              {shown.map((r) => {
                const title = rewardTitle(r, lang);
                const terms = lang === 'ms' ? r.terms_ms : r.terms;
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
                    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-orange text-2xl">
                      {r.emoji}
                    </span>
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <p className="break-words font-bold">{title}</p>
                      <p className="text-sm text-muted-2">{[r.partner_name, terms].filter(Boolean).join(' · ')}</p>
                      <p className="text-sm font-extrabold">★ {formatPoints(r.points_cost, lang)}</p>
                    </div>
                    {balance >= r.points_cost ? (
                      <RedeemButton rewardId={r.id} title={title} canAct={profile.status === 'verified'} />
                    ) : (
                      <span className="shrink-0 rounded-xl bg-chip px-3 py-2.5 text-sm font-extrabold text-muted-2">
                        {t(lang, 'reward.more', { n: formatPoints(r.points_cost - balance, lang) })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-center text-xs text-muted-2">{t(lang, 'reward.placeholders')}</p>
          </>
        )}
      </main>
    </>
  );
}
