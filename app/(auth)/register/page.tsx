import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RegisterFlow } from '@/components/auth/RegisterFlow';
import { buttonClasses } from '@/components/ui/Button';
import { REGISTER_CODE_COOKIE } from '@/lib/card/register';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile, homePath } from '@/lib/supabase/auth';

/** Register with a code from the office, or an invite from the family. */
export default async function RegisterPage() {
  const profile = await getSessionProfile();
  if (profile) redirect(homePath(profile));
  const lang = await getLang();
  // Try registering (Nur) brings its code in an httpOnly cookie, so a code is never in a URL.
  const code = (await cookies()).get(REGISTER_CODE_COOKIE)?.value ?? null;
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <header className="bg-brand-gradient px-6 pb-8 pt-12 text-white">
        <Image src="/brand/logo-horizontal-white.png" alt="Serumpun" width={1200} height={305} priority className="h-auto w-44" />
        <h1 className="mt-1 text-3xl font-extrabold">{t(lang, 'landing.register')}</h1>
      </header>
      <div className="grid gap-8 px-6 py-8">
        <RegisterFlow initialCode={code} />
        <section className="grid gap-3">
          <p className="text-sm text-muted">{t(lang, 'register.haveAccount')}</p>
          <Link href="/sign-in" className={`${buttonClasses('outline', 'lg')} w-full`}>
            {t(lang, 'auth.signIn')}
          </Link>
        </section>
      </div>
    </main>
  );
}
