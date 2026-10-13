import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile, homePath } from '@/lib/supabase/auth';
import { SignUpForm } from '../forms';

export default async function SignupPage() {
  const profile = await getSessionProfile();
  if (profile) redirect(homePath(profile.role));
  const lang = await getLang();
  // Visitors have no database access at all, so this public list is read here on the server with the service key.
  const { data: townships, error } = await createAdminClient()
    .from('townships')
    .select('slug, name, active')
    .order('active', { ascending: false })
    .order('name');
  if (error) throw new Error(`townships: ${error.message}`);
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <header className="bg-brand-gradient px-6 pb-8 pt-12 text-white">
        <p className="text-xl font-extrabold tracking-tight">Serumpun</p>
        <h1 className="mt-1 text-3xl font-extrabold">{t(lang, 'signup.title')}</h1>
      </header>
      <div className="grid gap-6 px-6 py-8">
        <p className="text-sm text-muted-2">{t(lang, 'signup.intro')}</p>
        <SignUpForm townships={townships} />
        <section className="grid gap-3">
          <p className="text-sm text-muted">{t(lang, 'signup.haveAccount')}</p>
          <Link href="/" className={`${buttonClasses('outline', 'lg')} w-full`}>
            {t(lang, 'auth.signIn')}
          </Link>
        </section>
      </div>
    </main>
  );
}
