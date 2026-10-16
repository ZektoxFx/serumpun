import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { ServiceForm } from '@/components/services/ServiceForm';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'create.service') };
}

/** "Offer or request a service" from the ＋ sheet and the Services tab. Pending residents see why they cannot post. */
export default async function NewServicePage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'create.service')} back="/community?tab=services" />
      <main className="px-4 py-4">
        <ServiceForm canPost={profile.status === 'verified'} />
      </main>
    </>
  );
}
