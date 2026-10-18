import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { HeroChip } from '@/components/app/HeroChip';
import { LiveClock, SlideToUse } from '@/components/rewards/SlideToUse';
import { Glyph } from '@/components/ui/Glyph';
import { QR } from '@/components/ui/QR';
import { eventDay, eventTime } from '@/lib/domain/events';
import { formatPoints, rewardTitle, voucherState, type Reward } from '@/lib/domain/points';
import { isUuid } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'reward.voucher') };
}

type Voucher = {
  id: string;
  code: string;
  status: 'active' | 'used';
  expires_at: string;
  used_at: string | null;
  reward: Pick<Reward, 'title' | 'title_ms' | 'emoji' | 'partner_name' | 'points_cost'>;
};

/**
 * One voucher (canvas "My voucher"): QR and code, validity, "Slide to use" in front of the cashier, and the balance.
 * Once used it says when, beside a ticking clock, so a screenshot cannot pass for an unused voucher.
 */
export default async function VoucherPage({ params }: PageProps<'/rewards/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [voucher, points] = await Promise.all([
    supabase
      .from('redemptions')
      .select('id, code, status, expires_at, used_at, reward:rewards(title, title_ms, emoji, partner_name, points_cost)')
      .eq('id', id)
      .eq('user_id', profile.id) // the office may read every voucher, but none of them is its own to show or use
      .maybeSingle()
      .overrideTypes<Voucher, { merge: false }>(),
    supabase.rpc('my_points'),
  ]);
  for (const { error } of [voucher, points]) if (error) throw new Error(`voucher lookup failed: ${error.message}`);
  const v = voucher.data;
  if (!v) notFound();
  const state = voucherState(v, new Date());
  const usedAt = v.used_at ? new Date(v.used_at) : null;

  return (
    <>
      <AppHeader title={t(lang, 'reward.voucher')} back="/rewards?view=mine" />
      <main className="grid gap-3 px-4 py-4">
        <section className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-lg">
          {/* Only large, bold text on the gradient; the shop sits on a white chip. */}
          <div className="flex items-center gap-3 bg-brand-gradient px-4 py-4 text-white">
            <span aria-hidden="true" className="text-3xl">
              <Glyph emoji={v.reward.emoji} />
            </span>
            <div className="grid min-w-0 justify-items-start gap-1">
              <h2 className="break-words text-xl font-extrabold leading-tight">{rewardTitle(v.reward, lang)}</h2>
              <HeroChip>{v.reward.partner_name} · Elmina Lakeside Mall</HeroChip>
            </div>
          </div>
          <div className="grid justify-items-center gap-1.5 px-4 pb-5 pt-4 text-center">
            {state === 'active' && <QR value={v.code} label={t(lang, 'reward.qr', { code: v.code })} size={176} />}
            <p className="text-xl font-extrabold tracking-[0.12em]">{v.code}</p>
            <p className="text-xs text-muted-2">
              {usedAt
                ? t(lang, 'reward.usedAt', { time: `${eventDay(usedAt, lang)} · ${eventTime(usedAt, lang)}` })
                : t(lang, state === 'active' ? 'reward.validUntil' : 'reward.expired', { date: eventDay(new Date(v.expires_at), lang) })}
            </p>
          </div>
        </section>

        {state === 'active' && <SlideToUse voucherId={v.id} />}
        {usedAt && (
          <div role="status" className="grid justify-items-center gap-1 rounded-2xl bg-tint-green px-4 py-4 text-center text-green-text">
            <p className="text-base font-extrabold">✓ {t(lang, 'reward.usedAt', { time: eventTime(usedAt, lang) })}</p>
            <LiveClock />
          </div>
        )}

        <ol className="grid list-decimal gap-1 rounded-2xl border border-line bg-surface py-3 pl-8 pr-4 text-sm text-muted-2 shadow-card">
          <li>{t(lang, 'reward.step1')}</li>
          <li>{t(lang, 'reward.step2')}</li>
          <li>{t(lang, 'reward.step3')}</li>
        </ol>
        <p className="text-center text-xs text-muted-2">
          {t(lang, 'reward.pointsUsed', { n: formatPoints(v.reward.points_cost, lang), balance: formatPoints(Number(points.data ?? 0), lang) })}
        </p>
      </main>
    </>
  );
}
