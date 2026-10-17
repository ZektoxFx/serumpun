import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { NoticeForm } from '@/components/notices/NoticeForm';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'notice.title') };
}

/** Home › Notify office: tell the Management Office about renovation, moving day or contractors before they start. */
export default async function NewNoticePage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'notice.title')} back="/home" />
      <main className="flex flex-col gap-4 px-4 py-4">
        <p className="text-sm text-muted-2">{t(lang, 'notice.intro')}</p>
        <NoticeForm canPost={profile.status === 'verified'} />
      </main>
    </>
  );
}
