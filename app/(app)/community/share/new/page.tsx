import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { ListingForm } from '@/components/share/ListingForm';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'create.item') };
}

/** "List an item" from the ＋ sheet and the Share & Lend tab. Pending residents see why they cannot list. */
export default async function NewListingPage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'create.item')} back="/community?tab=share" />
      <main className="px-4 py-4">
        <ListingForm canPost={profile.status === 'verified'} />
      </main>
    </>
  );
}
