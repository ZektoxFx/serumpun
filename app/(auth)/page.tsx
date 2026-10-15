import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LanguageSwitch } from '@/components/app/LanguageSwitch';
import { buttonClasses } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { returnPath } from '@/lib/domain/notifications';
import { getSessionProfile, homePath } from '@/lib/supabase/auth';
import { DemoButtons, SignInForm } from './forms';

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
        <h1 className="text-4xl font-extrabold tracking-tight">Serumpun</h1>
        <p className="mt-2 text-xl font-bold">{t(lang, 'landing.tagline')}</p>
      </header>
      <div className="grid gap-8 px-6 py-8">
        <section aria-labelledby="demo-heading" className="grid gap-3">
          <h2 id="demo-heading" className="text-lg font-extrabold">
            {t(lang, 'landing.demo.title')}
          </h2>
          <DemoButtons next={next} />
        </section>
        <section aria-labelledby="sign-in-heading" className="grid gap-3">
          <h2 id="sign-in-heading" className="text-lg font-extrabold">
            {t(lang, 'landing.signIn.title')}
          </h2>
          <SignInForm next={next} />
        </section>
        <section className="grid gap-3">
          <p className="text-sm text-muted">{t(lang, 'landing.newHere')}</p>
          <Link href="/signup" className={`${buttonClasses('outline', 'lg')} w-full`}>
            {t(lang, 'landing.createAccount')}
          </Link>
        </section>
        <LanguageSwitch lang={lang} />
      </div>
    </main>
  );
}
