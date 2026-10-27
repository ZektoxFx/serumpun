import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { HeroChip } from '@/components/app/HeroChip';
import { LanguageSwitch } from '@/components/app/LanguageSwitch';
import { PushAlerts } from '@/components/app/PushAlerts';
import { TextSizeSwitch } from '@/components/app/TextSizeSwitch';
import { ThemeSwitch } from '@/components/app/ThemeSwitch';
import { HouseholdCard } from '@/components/card/HouseholdCard';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { DEMO_PIN } from '@/lib/card/pin';
import { loadMyCard } from '@/lib/card/summary';
import { HELP_LINKS, ME_LINKS } from '@/lib/domain/nav';
import { formatPoints, nextReward, rewardTitle } from '@/lib/domain/points';
import { statusKey } from '@/lib/domain/profile';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { isTextSize } from '@/lib/textSize';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.me') };
}

const row = 'flex min-h-14 items-center gap-3 px-4';
// A link or button row fills an overflow-hidden, rounded list. The global focus ring sits outside the element and would be
// clipped, so it is drawn inside; and the row takes the list's corners (the li and form pass them down), so at the top and
// bottom of the list the ring follows the curve instead of being cut off by it.
const pressable = `${row} rounded-[inherit] hover:bg-soft focus-visible:outline-offset-[-2px]`;
const rowIcon = 'w-6 shrink-0 text-center text-lg';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function MePage({ searchParams }: PageProps<'/me'>) {
  const profile = await requireMember();
  const lang = await getLang();
  // Register opens Me this way once the card is made.
  const ready = (await searchParams).ready === '1';
  const textSize = (await cookies()).get('textSize')?.value;
  const supabase = await createClient();
  const now = new Date();
  // Row-level security: the caller's own ledger entries, vouchers and household card.
  const [total, catalog, week, vouchers, card] = await Promise.all([
    supabase.rpc('my_points'),
    supabase.from('rewards').select('id, title, title_ms, points_cost').eq('active', true),
    supabase
      .from('points_ledger')
      .select('delta, ref_id')
      .eq('reason', 'event')
      .gte('created_at', new Date(now.getTime() - WEEK_MS).toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .gt('expires_at', now.toISOString()),
    loadMyCard(supabase, profile.id),
  ]);
  for (const { error } of [total, catalog, week, vouchers]) if (error) throw new Error(`points lookup failed: ${error.message}`);
  // A demo account is shared by every visitor, so its PIN is shown on the pad. `app_metadata` is set by the seed only.
  const demo = card && (await supabase.auth.getClaims()).data?.claims.app_metadata?.demo;
  const points = Number(total.data ?? 0);
  const next = nextReward(points, catalog.data!);
  // "+150 this week · Gotong-royong": the week's check-ins, named after the latest.
  const latest = week.data![0];
  const { data: latestEvent } = latest
    ? await supabase.from('public_events').select('title').eq('id', latest.ref_id).maybeSingle()
    : { data: null };
  const earned = week.data!.reduce((sum, e) => sum + e.delta, 0);

  return (
    <>
      <header className="bg-brand-gradient px-4 pb-16 pt-6 text-white">
        <div className="flex items-center gap-4">
          <Avatar name={profile.full_name} size={64} />
          <div className="min-w-0">
            <h1 className="break-words text-xl font-extrabold leading-tight">{profile.full_name}</h1>
            <HeroChip className="mt-2">
              {profile.neighbourhood} · {t(lang, statusKey(profile))}
            </HeroChip>
          </div>
        </div>
      </header>

      <main className="relative -mt-10 grid gap-3 px-4">
        {ready && card && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-tint-green px-3 py-2 text-base font-extrabold text-green-text">
            <span aria-hidden="true">✓</span>
            {t(lang, 'me.ready')}
          </p>
        )}
        {card && <HouseholdCard summary={card} demoPin={demo ? DEMO_PIN : null} />}

        <section aria-labelledby="your-points" className="rounded-2xl border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="your-points" className="text-xs font-extrabold uppercase tracking-wide text-muted">
                {t(lang, 'me.points')}
              </h2>
              <p className="whitespace-nowrap text-3xl font-extrabold leading-tight">
                <Glyph emoji="★" /> {formatPoints(points, lang)}
              </p>
            </div>
            <Link href="/rewards" className={buttonClasses('primary')}>
              {t(lang, 'me.rewards')}
            </Link>
          </div>
          {latestEvent && (
            <p className="mt-1 text-sm font-bold text-green-text">
              {t(lang, 'points.recent', { n: formatPoints(earned, lang), title: latestEvent.title })}
            </p>
          )}
          {next && (
            <div className="mt-3 grid gap-1.5">
              {/* The sentence under it says the same, so the bar is hidden from screen readers. */}
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-chip">
                <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.round(next.progress * 100)}%` }} />
              </div>
              <p className="text-sm text-muted-2">
                {t(lang, 'points.next', { n: formatPoints(next.remaining, lang), reward: rewardTitle(next.reward, lang) })}
              </p>
            </div>
          )}
        </section>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {ME_LINKS.map((link) => (
            <li key={link.href} className="first:rounded-t-[inherit] last:rounded-b-[inherit]">
              <Link href={link.href} className={pressable}>
                <span aria-hidden="true" className={rowIcon}>
                  <Glyph emoji={link.icon} />
                </span>
                <span className="flex-1 text-base font-bold">{t(lang, link.label)}</span>
                {link.href === '/rewards?view=mine' && (
                  <span className="text-sm text-muted-2">{t(lang, 'me.activeVouchers', { n: vouchers.count ?? 0 })}</span>
                )}
                <span aria-hidden="true" className="text-xl text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="help-heading" className="grid gap-2">
          <h2 id="help-heading" className="px-1 pt-1 text-xs font-extrabold uppercase tracking-wide text-muted">
            {t(lang, 'me.help')}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {HELP_LINKS.map((link) => (
              <li key={link.href} className="first:rounded-t-[inherit] last:rounded-b-[inherit]">
                <Link href={link.href} className={`${pressable} py-2`}>
                  <span aria-hidden="true" className={rowIcon}>
                    <Glyph emoji={link.icon} />
                  </span>
                  <span className="grid flex-1">
                    <span className="text-base font-bold">{t(lang, link.label)}</span>
                    <span className="text-sm text-muted-2">{t(lang, link.hint)}</span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <li className={row}>
            <span aria-hidden="true" className={rowIcon}>
              <Glyph emoji="🌙" />
            </span>
            <label htmlFor="dark-mode" className="flex-1 text-base font-bold">
              {t(lang, 'me.darkMode')}
            </label>
            <ThemeSwitch id="dark-mode" />
          </li>

          <li className="grid gap-2 px-4 py-3">
            <span className="flex items-center gap-3 text-base font-bold">
              <span aria-hidden="true" className={rowIcon}>
                🚨
              </span>
              {t(lang, 'alerts.title')}
            </span>
            <PushAlerts />
          </li>

          <li className="grid gap-2 px-4 py-3">
            <span className="flex items-center gap-3 text-base font-bold">
              <span aria-hidden="true" className={rowIcon}>
                <Glyph emoji="🔠" />
              </span>
              {t(lang, 'me.textSize')}
            </span>
            <TextSizeSwitch size={isTextSize(textSize) ? textSize : 'md'} />
          </li>

          <li className="grid gap-2 px-4 py-3">
            <span className="flex items-center gap-3 text-base font-bold">
              <span aria-hidden="true" className={rowIcon}>
                <Glyph emoji="🌐" />
              </span>
              {t(lang, 'lang.label')}
            </span>
            <LanguageSwitch lang={lang} />
          </li>

          <li className={row}>
            <span aria-hidden="true" className={rowIcon}>
              <Glyph emoji="🏘️" />
            </span>
            <span className="flex-1 text-base font-bold">{t(lang, 'me.township')}</span>
            <span className="text-sm text-muted-2">{profile.township.name}</span>
          </li>

          <li className="rounded-b-[inherit]">
            <form action={signOut} className="rounded-[inherit]">
              <button className={`${pressable} w-full text-left text-base font-bold text-red-text`}>
                <span aria-hidden="true" className={rowIcon}>
                  <Glyph emoji="🚪" />
                </span>
                {t(lang, 'auth.signOut')}
              </button>
            </form>
          </li>
        </ul>
      </main>
    </>
  );
}
