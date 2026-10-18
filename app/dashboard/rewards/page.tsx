import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import { eventDay, eventTime } from '@/lib/domain/events';
import { rewardTitle, voucherState, type Reward } from '@/lib/domain/points';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.rewards') };
}

type Row = {
  id: string;
  code: string;
  status: 'active' | 'used';
  created_at: string;
  expires_at: string;
  reward: Pick<Reward, 'title' | 'title_ms' | 'emoji'>;
  resident: { full_name: string } | null;
};

/** Every voucher redeemed in the township, newest first: what, who, and whether it is still unused. */
export default async function DashboardRewardsPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security: vouchers of the office's own township's rewards, and its residents' names.
  const { data: vouchers, error } = await supabase
    .from('redemptions')
    .select('id, code, status, created_at, expires_at, reward:rewards(title, title_ms, emoji), resident:profiles(full_name)')
    .order('created_at', { ascending: false })
    .overrideTypes<Row[], { merge: false }>();
  if (error) throw new Error(`vouchers lookup failed: ${error.message}`);
  const now = new Date();
  const head = 'px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-muted';

  return (
    <main className="grid gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.rewards')}</h1>
      <p className="text-sm text-muted-2">{t(lang, 'dashboard.rewards.intro')}</p>
      {vouchers.length === 0 ? (
        <EmptyState icon="🎁" title={t(lang, 'dashboard.rewards.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={head}>{t(lang, 'dashboard.rewards.code')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.rewards.reward')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.rewards.resident')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.rewards.status')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.rewards.redeemed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vouchers.map((v) => {
                const state = voucherState(v, now);
                const at = new Date(v.created_at);
                return (
                  <tr key={v.id}>
                    <th scope="row" className="px-3 py-3 font-bold tracking-wider">{v.code}</th>
                    <td className="px-3 py-3">
                      <Glyph emoji={v.reward.emoji} /> {rewardTitle(v.reward, lang)}
                    </td>
                    <td className="px-3 py-3">{v.resident?.full_name ?? '–'}</td>
                    <td className="px-3 py-3">
                      <Tag variant={state === 'active' ? 'green' : 'info'}>{t(lang, `reward.status.${state}`)}</Tag>
                    </td>
                    <td className="px-3 py-3 text-muted-2">
                      {eventDay(at, lang)} · {eventTime(at, lang)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
