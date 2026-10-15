import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { HappeningNow } from '@/components/app/HappeningNow';
import { HeroChip } from '@/components/app/HeroChip';
import { Tile } from '@/components/app/Tile';
import { HOME_TILES } from '@/lib/domain/nav';
import { formatPoints } from '@/lib/domain/points';
import { firstName, statusKey } from '@/lib/domain/profile';
import { greetingKey } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.home') };
}

export default async function HomePage() {
  const profile = await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: points, error } = await supabase.rpc('my_points');
  if (error) throw new Error(`points lookup failed: ${error.message}`);
  return (
    <>
      <AppHeader
        tone="gradient"
        showBell
        showInbox
        title={t(lang, `home.greeting.${greetingKey(new Date())}`, { name: firstName(profile.full_name) })}
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <HeroChip>
            {profile.township.name} · {profile.neighbourhood}
          </HeroChip>
          <HeroChip>{t(lang, statusKey(profile))}</HeroChip>
          <HeroChip>
            <span aria-hidden="true">★</span> {t(lang, 'points.count', { n: formatPoints(Number(points ?? 0), lang) })}
          </HeroChip>
        </div>
      </AppHeader>

      <main className="grid gap-5 px-4 py-4">
        <Link
          href="/reports/new"
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-red text-lg font-extrabold text-white">
            !
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold">{t(lang, 'create.report')}</span>
            <span className="block text-sm text-muted-2">{t(lang, 'home.report.body')}</span>
          </span>
          <span aria-hidden="true" className="text-xl text-muted">
            ›
          </span>
        </Link>

        <ul className="grid grid-cols-4 gap-2">
          {HOME_TILES.map((tile) => (
            <li key={tile.href} className="flex">
              <Tile href={tile.href} icon={tile.icon} label={t(lang, tile.label)} />
            </li>
          ))}
        </ul>

        <HappeningNow />
      </main>
    </>
  );
}
