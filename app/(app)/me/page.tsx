import type { Metadata } from 'next';
import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { HeroChip } from '@/components/app/HeroChip';
import { LanguageSwitch } from '@/components/app/LanguageSwitch';
import { ThemeSwitch } from '@/components/app/ThemeSwitch';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { ME_LINKS } from '@/lib/domain/nav';
import { statusKey } from '@/lib/domain/profile';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.me') };
}

const row = 'flex min-h-14 items-center gap-3 px-4';
const rowIcon = 'w-6 shrink-0 text-center text-lg';

export default async function MePage() {
  const profile = await requireMember();
  const lang = await getLang();
  const points = 0; // Task 11 reads the real balance from the points ledger
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
        <section aria-labelledby="your-points" className="rounded-2xl border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="your-points" className="text-xs font-extrabold uppercase tracking-wide text-muted">
                {t(lang, 'me.points')}
              </h2>
              <p className="text-3xl font-extrabold leading-tight">
                <span aria-hidden="true">★</span> {points}
              </p>
            </div>
            <Link href="/rewards" className={buttonClasses('primary')}>
              {t(lang, 'me.rewards')}
            </Link>
          </div>
        </section>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {ME_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={`${row} hover:bg-soft`}>
                <span aria-hidden="true" className={rowIcon}>
                  {link.icon}
                </span>
                <span className="flex-1 text-base font-bold">{t(lang, link.label)}</span>
                <span aria-hidden="true" className="text-xl text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}

          <li className={row}>
            <span aria-hidden="true" className={rowIcon}>
              🌙
            </span>
            <label htmlFor="dark-mode" className="flex-1 text-base font-bold">
              {t(lang, 'me.darkMode')}
            </label>
            <ThemeSwitch id="dark-mode" />
          </li>

          <li className="grid gap-2 px-4 py-3">
            <span className="flex items-center gap-3 text-base font-bold">
              <span aria-hidden="true" className={rowIcon}>
                🌐
              </span>
              {t(lang, 'lang.label')}
            </span>
            <LanguageSwitch lang={lang} />
          </li>

          <li className={row}>
            <span aria-hidden="true" className={rowIcon}>
              🏘️
            </span>
            <span className="flex-1 text-base font-bold">{t(lang, 'me.township')}</span>
            <span className="text-sm text-muted-2">{profile.township.name}</span>
          </li>

          <li>
            <form action={signOut}>
              <button className={`${row} w-full text-left text-base font-bold text-red-text hover:bg-soft`}>
                <span aria-hidden="true" className={rowIcon}>
                  🚪
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
