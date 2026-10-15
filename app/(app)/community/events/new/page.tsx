import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { EventForm } from '@/components/events/EventForm';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'create.event') };
}

/** "Create an event" from the ＋ sheet. Pending residents see the form with the reason in place of a working button. */
export default async function NewEventPage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'create.event')} back="/community?tab=events" />
      <main className="px-4 py-4">
        <EventForm canPost={profile.status === 'verified'} />
      </main>
    </>
  );
}
