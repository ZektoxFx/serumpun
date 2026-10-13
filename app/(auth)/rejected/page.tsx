import { redirect } from 'next/navigation';
import { signOut } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile, homePath } from '@/lib/supabase/auth';

/** Where a rejected applicant lands instead of the app (the database gives them no township data either). */
export default async function RejectedPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/');
  if (profile.status !== 'rejected') redirect(homePath(profile));
  const lang = await getLang();
  return (
    <main className="mx-auto grid max-w-md gap-4 px-6 py-10">
      <h1 className="text-2xl font-extrabold">{t(lang, 'rejected.title')}</h1>
      <p className="text-muted-2">{t(lang, 'rejected.body')}</p>
      <form action={signOut}>
        <Button variant="outline" className="w-full">
          {t(lang, 'auth.signOut')}
        </Button>
      </form>
    </main>
  );
}
