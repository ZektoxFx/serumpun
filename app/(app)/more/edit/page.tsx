import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { FavouritesEditor } from '@/components/home/FavouritesEditor';
import { resolveFavourites } from '@/lib/domain/nav';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'more.edit.title') };
}

/** Edit favourites: remove, add and reorder what Home shows; nothing changes until Save. */
export default async function EditFavouritesPage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'more.edit.title')} back="/home" />
      <main className="px-4 py-4">
        <FavouritesEditor initial={resolveFavourites(profile.favourites).map((s) => s.key)} />
      </main>
    </>
  );
}
