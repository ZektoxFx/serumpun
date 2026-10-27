import Image from 'next/image';
import { redirect } from 'next/navigation';
import { PhoneSignIn } from '@/components/auth/PhoneSignIn';
import { returnPath } from '@/lib/domain/notifications';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile, homePath } from '@/lib/supabase/auth';
import { SignInForm } from '../forms';

/** Residents sign in with their phone, an SMS code and their PIN; office staff keep email and password, under it. */
export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  // Where a signed-out visitor was sent away from (proxy.ts, through the landing page): signing in goes back there.
  const next = returnPath((await searchParams).next) ?? undefined;
  const profile = await getSessionProfile();
  if (profile) redirect(homePath(profile));
  const lang = await getLang();
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <header className="bg-brand-gradient px-6 pb-8 pt-12 text-white">
        <Image src="/brand/logo-horizontal-white.png" alt="Serumpun" width={1200} height={305} priority className="h-auto w-44" />
        <h1 className="mt-1 text-3xl font-extrabold">{t(lang, 'auth.signIn')}</h1>
      </header>
      <div className="grid gap-8 px-6 py-8">
        <PhoneSignIn next={next} />
        <details className="group rounded-2xl border border-line bg-surface shadow-card open:border-line-strong">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
            {t(lang, 'signIn.staff')}
            <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none">
              ›
            </span>
          </summary>
          <div className="px-4 pb-4">
            <SignInForm next={next} />
          </div>
        </details>
      </div>
    </main>
  );
}
