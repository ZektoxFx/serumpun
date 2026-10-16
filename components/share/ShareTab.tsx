import Link from 'next/link';
import { KIND_TAG, tintFor } from '@/components/share/shareStyle';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import {
  LISTING_KINDS,
  MY_BORROW_COLUMNS,
  PUBLIC_LISTING_COLUMNS,
  type ListingKind,
  type MyBorrow,
  type PublicListing,
} from '@/lib/domain/community';
import { eventDay, mytDateTime } from '@/lib/domain/events';
import { formatDistance } from '@/lib/domain/geo';
import { neighbourhoodDistance } from '@/lib/domain/places';
import { t, type Lang } from '@/lib/i18n';
import type { SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Community › Share & Lend (the approved canvas artboard): what neighbours lend, give away or swap (`?kind=`), newest
 * first, two to a row, each with who lists it and how far their neighbourhood is. `?view=mine` (Me › My listings) shows
 * what the resident is borrowing and what they list instead.
 */
export async function ShareTab({
  profile,
  lang,
  params,
}: {
  profile: SessionProfile;
  lang: Lang;
  params: Record<string, string | string[] | undefined>;
}) {
  const mine = params.view === 'mine';
  const kind = mine ? null : (LISTING_KINDS.find((k) => k === params.kind) ?? null);
  const supabase = await createClient();
  const all = supabase.from('public_listings').select(PUBLIC_LISTING_COLUMNS).order('created_at', { ascending: false });
  const [listings, borrows] = await Promise.all([
    // My listings include the ones given away; everyone's are what is up.
    (mine ? all.eq('is_mine', true) : all.eq('status', 'available')).overrideTypes<PublicListing[], { merge: false }>(),
    mine
      ? supabase
          .from('my_borrows')
          .select(MY_BORROW_COLUMNS)
          .eq('my_role', 'borrower')
          .in('status', ['requested', 'approved', 'picked_up'])
          .order('from_date')
          .overrideTypes<MyBorrow[], { merge: false }>()
      : { data: [] as MyBorrow[], error: null },
  ]);
  for (const { error } of [listings, borrows]) if (error) throw new Error(`share lookup failed: ${error.message}`);
  const shown = listings.data!.filter((l) => kind === null || l.kind === kind);

  const segment = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-1 text-sm font-extrabold ${on ? 'bg-surface text-text shadow-card' : 'text-muted-2'}`;
  const kinds: (ListingKind | null)[] = [null, ...LISTING_KINDS];

  return (
    <main className="grid grid-cols-1 gap-3 px-4 py-4">
      <nav aria-label={t(lang, 'share.views')} className="flex rounded-xl bg-chip p-1">
        {kinds.map((k) => (
          <Link
            key={k ?? 'all'}
            href={k ? `/community?tab=share&kind=${k}` : '/community?tab=share'}
            aria-current={!mine && kind === k ? 'page' : undefined}
            className={segment(!mine && kind === k)}
          >
            {k ? t(lang, `share.kind.${k}`) : t(lang, 'event.all')}
          </Link>
        ))}
      </nav>

      {mine && borrows.data!.length > 0 && (
        <section aria-labelledby="borrowing" className="grid gap-2">
          <h2 id="borrowing" className="text-base font-extrabold">
            {t(lang, 'share.mine.borrowing')}
          </h2>
          <ul className="flex flex-col gap-2">
            {borrows.data!.map((b) => (
              <li key={b.id}>
                <Link href={`/community/share/${b.listing_id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card hover:bg-soft">
                  <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-xl text-2xl ${tintFor(b.listing_id)}`}>
                    {b.listing_emoji}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="break-words font-bold">{b.listing_title}</span>
                    <span className="text-xs text-muted-2">
                      {b.owner_name} · {eventDay(mytDateTime(b.from_date, '12:00')!, lang)} – {eventDay(mytDateTime(b.to_date, '12:00')!, lang)}
                    </span>
                  </span>
                  <Tag variant={b.status === 'requested' ? 'amber' : 'green'}>{t(lang, `share.status.${b.status}`)}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mine && (
        <h2 className="text-base font-extrabold">{t(lang, 'share.mine.listings')}</h2>
      )}

      {shown.length === 0 ? (
        <EmptyState icon="🔁" title={t(lang, mine ? 'share.mine.empty' : 'share.empty')} description={t(lang, 'share.emptyHint')} />
      ) : (
        <ul className="grid grid-cols-2 gap-2.5">
          {shown.map((l) => (
            <li key={l.id} className="flex">
              <ListingCard listing={l} viewer={profile.neighbourhood} lang={lang} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/community/share/new" className={`${buttonClasses('outline')} mt-1`}>
        <span aria-hidden="true">＋</span> {t(lang, 'create.item')}
      </Link>
      <p className="text-center text-xs text-muted-2">{t(lang, 'share.noSelling')}</p>
    </main>
  );
}

/** "Your area" or "1.5 km" between the two neighbourhoods; null when either is not on the list of centres. */
export function howFar(viewer: string, owner: string, lang: Lang): string | null {
  const m = neighbourhoodDistance(viewer, owner);
  return m === null ? null : m === 0 ? t(lang, 'share.yourArea') : formatDistance(m);
}

/** A card of the canvas: the tinted emoji, the kind's tag, the title, and who lists it how far away. */
function ListingCard({ listing: l, viewer, lang }: { listing: PublicListing; viewer: string; lang: Lang }) {
  return (
    <Link
      href={`/community/share/${l.id}`}
      className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card hover:bg-soft"
    >
      <span aria-hidden="true" className={`grid h-18 place-items-center text-4xl ${tintFor(l.id)}`}>
        {l.emoji}
      </span>
      <span className="flex flex-col items-start gap-1 px-3 py-2.5">
        <Tag variant={KIND_TAG[l.kind]}>{t(lang, `share.tag.${l.kind}`)}</Tag>
        <span className="break-words text-sm font-bold leading-snug">{l.title}</span>
        <span className="break-words text-xs text-muted-2">
          {l.is_mine
            ? l.status === 'given'
              ? t(lang, 'share.given')
              : l.waiting_count > 0
                ? t(lang, 'share.waiting', { n: l.waiting_count })
                : l.owner_neighbourhood
            : `${l.owner_name} · ${howFar(viewer, l.owner_neighbourhood, lang) ?? l.owner_neighbourhood}`}
        </span>
      </span>
    </Link>
  );
}
