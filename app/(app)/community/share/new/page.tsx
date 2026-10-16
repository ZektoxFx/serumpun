import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { ListingForm } from '@/components/share/ListingForm';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'create.item') };
}

/** "List an item" from the ＋ sheet and the Share & Lend tab, with the groups it can also be posted to. Pending residents see why they cannot list. */
export default async function NewListingPage() {
  const profile = await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: groups, error } = await supabase
    .from('public_groups')
    .select('id, name')
    .eq('is_member', true)
    .order('name')
    .overrideTypes<{ id: string; name: string }[], { merge: false }>();
  if (error) throw new Error(`groups lookup failed: ${error.message}`);
  return (
    <>
      <AppHeader title={t(lang, 'create.item')} back="/community?tab=share" />
      <main className="px-4 py-4">
        <ListingForm canPost={profile.status === 'verified'} groups={groups} />
      </main>
    </>
  );
}
