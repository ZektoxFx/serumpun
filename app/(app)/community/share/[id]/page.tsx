import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { BackButton } from '@/components/app/BackButton';
import { MessageButton } from '@/components/app/MessageButton';
import { BorrowForm } from '@/components/share/BorrowForm';
import { BorrowMove } from '@/components/share/BorrowMove';
import { BorrowSteps } from '@/components/share/BorrowSteps';
import { howFar } from '@/components/share/ShareTab';
import { KIND_TAG, tintFor } from '@/components/share/shareStyle';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import {
  MY_BORROW_COLUMNS,
  PUBLIC_LISTING_COLUMNS,
  borrowMoves,
  type BorrowStatus,
  type MyBorrow,
  type PublicListing,
} from '@/lib/domain/community';
import { eventDay, mytDateTime } from '@/lib/domain/events';
import { isUuid } from '@/lib/domain/reports';
import { mytDate } from '@/lib/domain/time';
import { t, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** The listing, if it is up (or the reader's own), shared by the page and its title. */
const getListing = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_listings')
    .select(PUBLIC_LISTING_COLUMNS)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<PublicListing, { merge: false }>();
  if (error) throw new Error(`listing lookup failed: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<'/community/share/[id]'>): Promise<Metadata> {
  const [lang, listing] = await Promise.all([getLang(), getListing((await params).id)]);
  return { title: listing?.title ?? t(lang, 'community.tab.share') };
}

const OPEN: readonly BorrowStatus[] = ['requested', 'approved', 'picked_up'];
const DAY = 86_400_000;
const day = (date: string, lang: Lang) => eventDay(mytDateTime(date, '12:00')!, lang);
const dates = (b: MyBorrow, lang: Lang) => `${day(b.from_date, lang)} – ${day(b.to_date, lang)}`;

/**
 * One listing (brainstorm "Share & Lend"): the item, its owner and how far they are, and then by who reads it: dates and
 * "Request to borrow", or their request's four steps (lend); "Message [owner]" (give away and swap); the requests to
 * answer and "take it down" (the owner).
 */
export default async function ListingPage({ params }: PageProps<'/community/share/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const listing = await getListing((await params).id);
  if (!listing) notFound();
  const supabase = await createClient();
  // The requests the reader is part of: every one for the owner, their own for anyone else.
  const { data: borrows, error } = await supabase
    .from('my_borrows')
    .select(MY_BORROW_COLUMNS)
    .eq('listing_id', listing.id)
    .order('updated_at', { ascending: false })
    .overrideTypes<MyBorrow[], { merge: false }>();
  if (error) throw new Error(`borrow requests lookup failed: ${error.message}`);
  const verified = profile.status === 'verified';
  const open = borrows.find((b) => b.my_role === 'borrower' && OPEN.includes(b.status));
  const lastClosed = open ? undefined : borrows.find((b) => b.my_role === 'borrower');
  const owner = listing.owner_name;
  // The form's first guess: from today, back in two days, but not after the item stops being lent.
  const now = new Date();
  const today = mytDate(now);
  const inTwoDays = mytDate(new Date(now.getTime() + 2 * DAY));
  const returnBy = listing.available_until && listing.available_until < inTwoDays ? listing.available_until : inTwoDays;
  const facts = [
    listing.description,
    listing.available_until && t(lang, 'share.availableUntil', { date: day(listing.available_until, lang) }),
  ].filter(Boolean);

  return (
    <>
      <div className={`relative grid h-44 place-items-center ${tintFor(listing.id)}`}>
        <div className="absolute left-4 top-4">
          <BackButton fallback="/community?tab=share" />
        </div>
        <span aria-hidden="true" className="text-7xl">
          {listing.emoji}
        </span>
      </div>

      <main className="flex flex-col gap-3 px-4 py-4">
        <Tag variant={KIND_TAG[listing.kind]} className="self-start">
          {t(lang, `share.tag.${listing.kind}`)}
        </Tag>
        <h1 className="break-words text-2xl font-extrabold leading-tight">{listing.title}</h1>
        {facts.length > 0 && <p className="break-words text-sm text-muted-2">{facts.join(' · ')}</p>}
        {listing.swap_for && <p className="break-words text-sm font-bold">{t(lang, 'share.wants', { what: listing.swap_for })}</p>}

        <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <Avatar name={listing.owner_name} size={44} />
          <div className="min-w-0">
            <p className="break-words font-bold">{listing.owner_name}</p>
            <p className="break-words text-sm text-muted-2">
              {[listing.owner_neighbourhood, howFar(profile.neighbourhood, listing.owner_neighbourhood, lang), `✓ ${t(lang, 'share.verified')}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </section>

        {listing.status === 'given' ? (
          <p className="rounded-xl bg-soft px-3 py-2.5 text-center text-sm font-bold">{t(lang, 'share.given')}</p>
        ) : listing.is_mine ? (
          <>
            {listing.kind === 'lend' && (
              <section aria-labelledby="requests" className="flex flex-col gap-2">
                <h2 id="requests" className="text-base font-extrabold">
                  {t(lang, 'share.requests')}
                </h2>
                {borrows.length === 0 ? (
                  <p className="text-sm text-muted-2">{t(lang, 'share.requests.empty')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {borrows.map((b) => (
                      <li key={b.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-card">
                        <div className="flex items-center gap-3">
                          <Avatar name={b.borrower_name} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-bold">{b.borrower_name}</p>
                            <p className="text-xs text-muted-2">
                              {b.borrower_neighbourhood} · {dates(b, lang)}
                            </p>
                          </div>
                          <Tag variant={b.status === 'requested' ? 'amber' : OPEN.includes(b.status) ? 'green' : 'info'}>
                            {t(lang, `share.status.${b.status}`)}
                          </Tag>
                        </div>
                        {borrowMoves(b.status, 'owner').length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {borrowMoves(b.status, 'owner').map((next) => (
                              <BorrowMove
                                key={next}
                                requestId={b.id}
                                next={next}
                                label={t(lang, `share.action.${next}`)}
                                variant={next === 'declined' ? 'outline' : 'primary'}
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <BorrowMove listingId={listing.id} label={t(lang, listing.kind === 'give' ? 'share.close.give' : 'share.close.other')} />
          </>
        ) : listing.kind === 'lend' ? (
          open ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
              <BorrowSteps status={open.status} lang={lang} />
              <p className="text-sm">{t(lang, 'share.yourRequest', { dates: dates(open, lang) })}</p>
              {borrowMoves(open.status, 'borrower').map((next) => (
                <BorrowMove key={next} requestId={open.id} next={next} label={t(lang, `share.action.${next}`)} />
              ))}
            </section>
          ) : (
            <>
              {lastClosed && (
                <p className="rounded-xl bg-soft px-3 py-2.5 text-sm">
                  {t(lang, `share.status.${lastClosed.status}`)} · {dates(lastClosed, lang)}
                </p>
              )}
              <BorrowForm listingId={listing.id} today={today} returnBy={returnBy} until={listing.available_until} canAct={verified} />
              <MessageButton contextType="listing" contextId={listing.id} label={t(lang, 'messages.messageOwner', { name: owner })} canAct={verified} />
            </>
          )
        ) : (
          <MessageButton
            contextType="listing"
            contextId={listing.id}
            label={t(lang, 'messages.messageOwner', { name: owner })}
            canAct={verified}
            variant="primary"
          />
        )}
        {!verified && !listing.is_mine && <p className="text-sm text-muted-2">{t(lang, 'common.pendingCantAct')}</p>}
      </main>
    </>
  );
}
