import type { Metadata } from 'next';
import { ResetDemo } from '@/components/dashboard/ResetDemo';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.reset') };
}

/** "Reset demo data": puts the whole demo back to its seeded state before a recording or a pitch. */
export default async function ResetPage() {
  await requireManagement();
  const lang = await getLang();
  return (
    <main className="grid max-w-2xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.reset')}</h1>
      <p className="text-base text-muted-2">{t(lang, 'dashboard.reset.body')}</p>
      <ResetDemo />
    </main>
  );
}
