import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LanguageSwitch } from '@/components/app/LanguageSwitch';
import { buttonClasses } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { returnPath } from '@/lib/domain/notifications';
import { getSessionProfile, homePath } from '@/lib/supabase/auth';
import { DemoButtons } from './forms';

export default async function LandingPage({ searchParams }: PageProps<'/'>) {
  // Where a signed-out visitor was sent away from (proxy.ts): signing in takes them back there.
  const next = returnPath((await searchParams).next) ?? undefined;
  const profile = await getSessionProfile();
  if (profile) redirect((profile.status !== 'rejected' && next) || homePath(profile));
  const lang = await getLang();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Only large, bold text on the gradient: white is ~3.6:1 over its orange stop. */}
      <header className="bg-brand-gradient px-6 pb-10 pt-16 text-white">
        <h1>
          <Image src="/brand/logo-horizontal-white.png" alt="Serumpun" width={1200} height={305} priority className="h-auto w-full max-w-80" />
        </h1>
        <p className="mt-2 text-xl font-bold">{t(lang, 'landing.tagline')}</p>
      </header>
      <div className="grid gap-8 px-6 py-8">
        <section className="grid gap-3">
          <Link href="/register" className={`${buttonClasses('primary', 'lg')} w-full`}>
            {t(lang, 'landing.register')}
          </Link>
          <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'} className={`${buttonClasses('outline', 'lg')} w-full`}>
            {t(lang, 'auth.signIn')}
          </Link>
          <p className="text-sm text-muted-2">{t(lang, 'landing.codeHint')}</p>
        </section>
        <section aria-labelledby="demo-heading" className="grid gap-3">
          <h2 id="demo-heading" className="text-lg font-extrabold">
            {t(lang, 'landing.demo.title')}
          </h2>
          <DemoButtons next={next} />
        </section>
        <LanguageSwitch lang={lang} />
      </div>
    </main>
  );
}
