import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { MallDirectory } from '@/components/malls/MallDirectory';
import { ELMINA_SHOPS } from '@/lib/domain/mallDirectory';
import { findMall } from '@/lib/domain/malls';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata({ params }: PageProps<'/malls/[mall]'>): Promise<Metadata> {
  const [lang, mall] = await Promise.all([getLang(), params.then((p) => findMall(p.mall))]);
  return { title: mall ? `${mall.name} · ${t(lang, 'service.mall')}` : t(lang, 'service.mall') };
}

/** Mall directory: Elmina Lakeside Mall's shops on its layout plan (the only mall with a directory for now). */
export default async function MallDirectoryPage({ params }: PageProps<'/malls/[mall]'>) {
  await requireMember();
  const lang = await getLang();
  const mall = findMall((await params).mall);
  if (!mall?.directory) notFound();
  return (
    <>
      <AppHeader
        title={
          <>
            {mall.name}
            <span className="block text-xs font-semibold tracking-normal text-muted-2">
              {t(lang, 'parking.hours')} · {t(lang, 'mall.shops', { n: ELMINA_SHOPS.length })}
            </span>
          </>
        }
        back={`/parking/${mall.slug}`}
      />
      <main className="grid gap-3 px-4 py-4">
        <p className="text-sm text-muted-2">
          {mall.address}{' '}
          <span className="inline-flex gap-3 font-bold">
            <a href={mall.waze} target="_blank" rel="noopener" className="text-red-text underline">
              Waze
            </a>
            <a href={mall.googleMaps} target="_blank" rel="noopener" className="text-red-text underline">
              Google Maps
            </a>
          </span>
        </p>
        <MallDirectory />
      </main>
    </>
  );
}
