import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import { distanceMeters, formatDistance } from '@/lib/domain/geo';
import { MALLS, rateText } from '@/lib/domain/malls';
import { neighbourhoodCentre } from '@/lib/domain/places';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'service.parking') };
}

/** Parking areas: only the malls (the user's call); each opens its parking options. */
export default async function ParkingPage() {
  const profile = await requireMember();
  const lang = await getLang();
  const home = neighbourhoodCentre(profile.neighbourhood);
  return (
    <>
      <AppHeader title={t(lang, 'service.parking')} back="/home" />
      <main className="grid gap-3 px-4 py-4">
        <p className="px-1 text-sm text-muted-2">{t(lang, 'parking.subtitle')}</p>
        <ul className="grid gap-3">
          {MALLS.map((mall) => {
            // How far only for the resident's own township's mall, from their neighbourhood (never a home).
            const away = home && mall.township === profile.township.name ? t(lang, 'parking.away', { distance: formatDistance(distanceMeters(home, mall)) }) : null;
            return (
              <li key={mall.slug}>
                <Link href={`/parking/${mall.slug}`} className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-card hover:bg-soft">
                  <span aria-hidden="true" className={`grid h-20 place-items-center text-4xl ${mall.directory ? 'bg-brand-gradient' : 'bg-sidebar'}`}>
                    <Glyph emoji={mall.directory ? '🛍️' : '🏬'} />
                  </span>
                  <span className="flex items-center gap-3 p-3.5">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-lg font-extrabold leading-snug">{mall.name}</span>
                      <span className="text-sm text-muted-2">{[mall.township ?? mall.area, away].filter(Boolean).join(' · ')}</span>
                      <span className="text-sm">
                        {rateText(mall.rate, lang)}
                        {mall.rate.sample && (
                          <Tag variant="amber" className="ml-2">
                            {t(lang, 'parking.sample')}
                          </Tag>
                        )}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-xl text-muted">
                      ›
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
