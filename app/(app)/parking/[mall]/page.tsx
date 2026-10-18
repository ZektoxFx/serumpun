import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { Glyph } from '@/components/ui/Glyph';
import { findMall, rateText } from '@/lib/domain/malls';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata({ params }: PageProps<'/parking/[mall]'>): Promise<Metadata> {
  const [lang, mall] = await Promise.all([getLang(), params.then((p) => findMall(p.mall))]);
  return { title: mall?.name ?? t(lang, 'service.parking') };
}

const card = 'flex min-h-14 items-center gap-3 rounded-2xl border bg-surface px-3.5 py-2.5 shadow-card';
const icon = 'grid size-9 shrink-0 place-items-center rounded-xl bg-chip text-lg';

/** One mall's parking: its car park map, then Pay parking, rates, free parking, valet, EV charging, directions, shops. */
export default async function MallParkingPage({ params }: PageProps<'/parking/[mall]'>) {
  await requireMember();
  const lang = await getLang();
  const mall = findMall((await params).mall);
  if (!mall) notFound();
  // Rows a mall has nothing to say for are left out.
  const facts = [
    { emoji: '💲', title: t(lang, 'parking.option.rates'), text: `${rateText(mall.rate, lang)}${mall.rate.sample ? ` (${t(lang, 'parking.sample')})` : ''}` },
    mall.freeParking && { emoji: '🆓', title: t(lang, 'parking.option.free'), text: t(lang, mall.freeParking) },
    { emoji: '🛎️', title: t(lang, 'parking.option.valet'), text: t(lang, mall.valet) },
    mall.ev && { emoji: '⚡', title: t(lang, 'parking.option.ev'), text: t(lang, mall.ev) },
  ].filter((fact) => !!fact);

  return (
    <>
      <AppHeader
        title={
          <>
            {mall.name}
            <span className="block text-xs font-semibold tracking-normal text-muted-2">{t(lang, 'parking.hours')}</span>
          </>
        }
        back="/parking"
      />
      <main className="grid gap-3 px-4 py-4">
        {mall.carParkMap && (
          <figure className="grid gap-1">
            <Image
              src={mall.carParkMap.src}
              width={mall.carParkMap.width}
              height={mall.carParkMap.height}
              alt={t(lang, 'parking.mapAlt')}
              className="h-auto w-full rounded-2xl border border-line"
              priority
            />
            <figcaption className="px-1 text-xs text-muted-2">{t(lang, 'parking.mapCredit')}</figcaption>
          </figure>
        )}
        <Link href={`/parking/pay?mall=${mall.slug}`} className={`${card} border-2 border-red bg-tint-red hover:brightness-95`}>
          <span aria-hidden="true" className={icon}>
            <Glyph emoji="🅿️" />
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="font-extrabold">{t(lang, 'service.payParking')}</span>
            <span className="text-sm text-muted-2">{t(lang, 'parking.option.pay.hint')}</span>
          </span>
          <span aria-hidden="true" className="text-xl text-muted">
            ›
          </span>
        </Link>
        {facts.map((fact) => (
          <div key={fact.title} className={`${card} border-line`}>
            <span aria-hidden="true" className={icon}>
              <Glyph emoji={fact.emoji} />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="font-bold">{fact.title}</span>
              <span className="text-sm text-muted-2">{fact.text}</span>
            </span>
          </div>
        ))}
        <div className={`${card} border-line`}>
          <span aria-hidden="true" className={icon}>
            <Glyph emoji="🧭" />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="font-bold">{t(lang, 'parking.option.directions')}</span>
            <span className="text-sm text-muted-2">{mall.address}</span>
            <span className="flex gap-4 text-sm font-bold">
              <a href={mall.waze} target="_blank" rel="noopener" className="min-h-11 content-center text-red-text underline">
                Waze
              </a>
              <a href={mall.googleMaps} target="_blank" rel="noopener" className="min-h-11 content-center text-red-text underline">
                Google Maps
              </a>
            </span>
          </span>
        </div>
        {mall.directory && (
          <Link href={`/malls/${mall.slug}`} className={`${card} border-line hover:bg-soft`}>
            <span aria-hidden="true" className={icon}>
              <Glyph emoji="🏬" />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="font-bold">{t(lang, 'service.mall')}</span>
              <span className="text-sm text-muted-2">{t(lang, 'parking.option.directory.hint')}</span>
            </span>
            <span aria-hidden="true" className="text-xl text-muted">
              ›
            </span>
          </Link>
        )}
      </main>
    </>
  );
}
