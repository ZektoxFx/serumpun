import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { GoingButton } from '@/components/events/GoingButton';
import { eventTags } from '@/components/events/eventTags';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import {
  EVENT_ICON,
  PUBLIC_EVENT_COLUMNS,
  eventDateParts,
  eventDay,
  eventTime,
  type EventCategory,
  type PublicEvent,
} from '@/lib/domain/events';
import { t, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.community') };
}

/** The chips under the switch (canvas): every category but "other", which only shows under All. */
const CHIPS: readonly EventCategory[] = ['official', 'sports', 'family', 'green'];

/**
 * Community (canvas "Community › Events"). Only the tabs that exist are listed (ruling R5): Groups, Services and Share &
 * Lend join as their tasks land, each answering to `?tab=`. Events: upcoming ones or the resident's own (`?view=mine`),
 * by category (`?cat=`), soonest first.
 */
export default async function CommunityPage({ searchParams }: PageProps<'/community'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const params = await searchParams;
  const mine = params.view === 'mine';
  const cat = CHIPS.find((c) => c === params.cat) ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_events')
    .select(PUBLIC_EVENT_COLUMNS)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .overrideTypes<PublicEvent[], { merge: false }>();
  if (error) throw new Error(`events lookup failed: ${error.message}`);
  const own = data.filter((e) => e.is_going || e.is_mine);
  const shown = (mine ? own : data).filter((e) => cat === null || e.category === cat);

  const href = (next: { view?: 'mine'; cat?: EventCategory | null }) => {
    const query = new URLSearchParams({ tab: 'events' });
    if (next.view) query.set('view', next.view);
    if (next.cat) query.set('cat', next.cat);
    return `/community?${query}`;
  };
  const segment = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${on ? 'bg-surface text-text shadow-card' : 'text-muted-2'}`;
  const chip = (on: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-4 text-sm font-bold ${
      on ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-text'
    }`;

  return (
    <>
      <AppHeader title={t(lang, 'nav.community')} showBell showInbox>
        <nav aria-label={t(lang, 'community.tabs')} className="mt-3 flex gap-2">
          <Link href="/community?tab=events" aria-current="page" className={`${chip(true)} border border-ink`}>
            {t(lang, 'community.tab.events')}
          </Link>
        </nav>
      </AppHeader>

      <main className="grid gap-3 px-4 py-4">
        <nav aria-label={t(lang, 'event.views')} className="flex rounded-xl bg-chip p-1">
          <Link href={href({ cat })} aria-current={mine ? undefined : 'page'} className={segment(!mine)}>
            {t(lang, 'event.upcoming', { n: data.length })}
          </Link>
          <Link href={href({ view: 'mine', cat })} aria-current={mine ? 'page' : undefined} className={segment(mine)}>
            {t(lang, 'event.mine', { n: own.length })}
          </Link>
        </nav>

        <nav aria-label={t(lang, 'event.categories')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Link href={href({ view: mine ? 'mine' : undefined })} aria-current={cat === null ? 'page' : undefined} className={chip(cat === null)}>
            {t(lang, 'event.all')}
          </Link>
          {CHIPS.map((c) => (
            <Link key={c} href={href({ view: mine ? 'mine' : undefined, cat: c })} aria-current={cat === c ? 'page' : undefined} className={chip(cat === c)}>
              <span aria-hidden="true">{EVENT_ICON[c]}</span> {t(lang, `event.category.${c}`)}
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <EmptyState
            icon="📅"
            title={t(lang, mine ? 'event.mine.empty' : 'event.empty')}
            description={t(lang, mine ? 'event.mine.emptyHint' : 'event.emptyHint')}
          />
        ) : (
          <ul className="grid gap-3">
            {shown.map((e) => (
              <li key={e.id}>
                <EventCard event={e} lang={lang} canAct={profile.status === 'verified'} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-center text-xs text-muted-2">{t(lang, 'event.pointsNote')}</p>
      </main>
    </>
  );
}

function EventCard({ event: e, lang, canAct }: { event: PublicEvent; lang: Lang; canAct: boolean }) {
  const starts = new Date(e.starts_at);
  const { weekday, day, month } = eventDateParts(starts, lang);
  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <div aria-hidden="true" className="flex w-14 shrink-0 flex-col items-center self-start rounded-xl bg-tint-orange py-2">
        <span className="text-xs font-extrabold text-orange-text">{weekday}</span>
        <span className="text-2xl font-extrabold leading-tight">{day}</span>
        <span className="text-xs font-bold text-muted-2">{month}</span>
      </div>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap gap-1">
          {eventTags(e, lang).map((tag) => (
            <Tag key={tag.text} variant={tag.variant}>
              {tag.text}
            </Tag>
          ))}
        </p>
        <h2 className="break-words text-base font-bold leading-snug">
          <Link href={`/community/events/${e.id}`} className="underline-offset-2 hover:underline">
            {e.title}
          </Link>
        </h2>
        <p className="text-sm text-muted-2">
          <span className="sr-only">{eventDay(starts, lang)}, </span>
          {t(lang, 'event.timePlace', { time: eventTime(starts, lang), place: e.location_text })}
        </p>
        <p className="text-sm text-muted-2">
          {e.organizer_name
            ? t(lang, 'event.byGoing', { name: e.organizer_name, n: e.going_count })
            : t(lang, 'event.goingCount', { n: e.going_count })}
        </p>
        {e.checked_in_at ? (
          <p className="text-sm font-bold text-green-text">✓ {t(lang, 'event.going')}</p>
        ) : (
          <GoingButton eventId={e.id} title={e.title} going={e.is_going} official={e.is_official} canAct={canAct} />
        )}
      </div>
    </article>
  );
}
