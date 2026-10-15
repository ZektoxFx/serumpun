import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { GroupForm } from '@/components/groups/GroupForm';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'group.create') };
}

/** "New group" from the Groups tab. Pending residents see the form with the reason in place of a working button. */
export default async function NewGroupPage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'group.create')} back="/community?tab=groups" />
      <main className="px-4 py-4">
        <GroupForm canPost={profile.status === 'verified'} />
      </main>
    </>
  );
}
