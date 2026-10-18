import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { PayParking } from '@/components/parking/PayParking';
import { Glyph } from '@/components/ui/Glyph';
import { MALLS, findMall } from '@/lib/domain/malls';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { savedPlates } from '@/lib/parking';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'service.payParking') };
}

/** Pay parking (`?mall=`): without a mall, which one first; then the plate, the amount and the demo payment. */
export default async function PayParkingPage({ searchParams }: PageProps<'/parking/pay'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const raw = (await searchParams).mall;
  const mall = findMall(Array.isArray(raw) ? raw[0] : raw);
  const plates = mall ? await savedPlates(profile.id) : [];
  return (
    <>
      <AppHeader
        title={
          <>
            {t(lang, 'service.payParking')}
            {mall && <span className="block text-xs font-semibold tracking-normal text-muted-2">{mall.name}</span>}
          </>
        }
        back={mall ? `/parking/${mall.slug}` : '/home'}
      />
      <main className="grid gap-3 px-4 py-4">
        {mall ? (
          <PayParking mall={mall} plates={plates} />
        ) : (
          <>
            <h2 className="px-1 text-lg font-extrabold">{t(lang, 'parking.pay.pickMall')}</h2>
            <ul className="grid gap-2">
              {MALLS.map((m) => (
                <li key={m.slug}>
                  <Link href={`/parking/pay?mall=${m.slug}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card hover:bg-soft">
                    <span aria-hidden="true" className="text-2xl">
                      <Glyph emoji={m.directory ? '🛍️' : '🏬'} />
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="font-extrabold">{m.name}</span>
                      <span className="text-sm text-muted-2">{m.township ?? m.area}</span>
                    </span>
                    <span aria-hidden="true" className="text-xl text-muted">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
