import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { eventDay } from '@/lib/domain/events';
import { balance, formatPoints, rewardTitle, type Reward } from '@/lib/domain/points';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'points.history') };
}

type Entry = { id: string; delta: number; reason: 'event' | 'reward'; ref_id: string; created_at: string };

/** Points history: every entry of the resident's ledger, newest first, named after its event or reward. */
export default async function PointsHistoryPage() {
  await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security: the caller's own entries only.
  const { data: entries, error } = await supabase
    .from('points_ledger')
    .select('id, delta, reason, ref_id, created_at')
    .order('created_at', { ascending: false })
    .overrideTypes<Entry[], { merge: false }>();
  if (error) throw new Error(`points lookup failed: ${error.message}`);
  const refs = (reason: Entry['reason']) => entries.filter((e) => e.reason === reason).map((e) => e.ref_id);
  const [events, vouchers] = await Promise.all([
    supabase.from('public_events').select('id, title').in('id', refs('event')),
    supabase
      .from('redemptions')
      .select('id, reward:rewards(title, title_ms)')
      .in('id', refs('reward'))
      .overrideTypes<{ id: string; reward: Pick<Reward, 'title' | 'title_ms'> }[], { merge: false }>(),
  ]);
  for (const { error } of [events, vouchers]) if (error) throw new Error(`points names lookup failed: ${error.message}`);
  const eventTitle = new Map(events.data!.map((e) => [e.id as string, e.title as string]));
  const rewardName = new Map(vouchers.data!.map((v) => [v.id, rewardTitle(v.reward, lang)]));

  return (
    <>
      <AppHeader title={t(lang, 'points.history')} back="/me" />
      <main className="grid gap-3 px-4 py-4">
        <p className="text-3xl font-extrabold">
          <Glyph emoji="★" /> {t(lang, 'points.count', { n: formatPoints(balance(entries), lang) })}
        </p>
        {entries.length === 0 ? (
          <EmptyState
            icon="★"
            title={t(lang, 'points.empty')}
            description={t(lang, 'points.emptyHint')}
            action={
              <Link href="/community?tab=events" className={buttonClasses('primary')}>
                {t(lang, 'community.tab.events')}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="w-6 shrink-0 text-center text-lg">
                  <Glyph emoji={e.reason === 'event' ? '📅' : '🎁'} />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="break-words text-sm font-bold">
                    {e.reason === 'event'
                      ? t(lang, 'points.checkedIn', { title: eventTitle.get(e.ref_id) ?? '' })
                      : t(lang, 'points.redeemed', { title: rewardName.get(e.ref_id) ?? '' })}
                  </span>
                  <span className="text-xs text-muted-2">{eventDay(new Date(e.created_at), lang)}</span>
                </span>
                <span className={`shrink-0 font-extrabold tabular-nums ${e.delta > 0 ? 'text-green-text' : 'text-red-text'}`}>
                  {e.delta > 0 ? '+' : '−'}
                  {formatPoints(Math.abs(e.delta), lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
