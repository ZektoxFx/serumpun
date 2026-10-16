import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { OpenGames } from '@/components/book/OpenGames';
import { SlotPicker } from '@/components/book/SlotPicker';
import { MiniMap } from '@/components/dashboard/MiniMap';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  FACILITY_COLUMNS,
  GAME_SPORTS,
  MY_BOOKING_COLUMNS,
  SPORTS,
  SPORT_ICON,
  bookableDates,
  householdHoursLeft,
  slotLabel,
  slotRange,
  slotStartUtc,
  slotStates,
  type Facility,
  type MyBooking,
  type Sport,
} from '@/lib/domain/booking';
import { eventDay, intlLocale } from '@/lib/domain/events';
import { distanceMeters, formatDistance, walkMinutes } from '@/lib/domain/geo';
import { neighbourhoodCentre } from '@/lib/domain/places';
import { TZ } from '@/lib/domain/time';
import { t, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember, type SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

type Params = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: PageProps<'/book'>): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, (await searchParams).view === 'mine' ? 'me.bookings' : 'book.title') };
}

/** Book a Court (canvas page 3), or My bookings with `?view=mine` (Me). */
export default async function BookPage({ searchParams }: PageProps<'/book'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const params = await searchParams;
  return params.view === 'mine' ? <MyBookings profile={profile} lang={lang} /> : <Picker profile={profile} lang={lang} params={params} />;
}

const chip = (on: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-sm font-bold ${
    on ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-text'
  }`;
const segment = (on: boolean) =>
  `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${on ? 'bg-surface text-text shadow-card' : 'text-muted-2'}`;

/**
 * "1 · Pick a slot": the sports, the courts of one, a map card with the distance and Directions (Safe Walk), the 7 days,
 * the day's slots with the household's hours left, then the township's open games. Sport, court and day live in the
 * address.
 */
async function Picker({ profile, lang, params }: { profile: SessionProfile; lang: Lang; params: Params }) {
  const supabase = await createClient();
  const { data: all, error } = await supabase
    .from('facilities')
    .select(FACILITY_COLUMNS)
    .order('court_label')
    .overrideTypes<Facility[], { merge: false }>();
  if (error) throw new Error(`courts lookup failed: ${error.message}`);
  const now = new Date();
  const dates = bookableDates(now);
  const sport = SPORTS.find((s) => s === params.sport) ?? 'badminton';
  const courts = all.filter((f) => f.sport === sport);
  const court = courts.find((c) => c.id === params.court) ?? courts[0];
  const date = dates.find((d) => d === params.date) ?? dates[0];
  const link = (next: { sport?: Sport; court?: string | null; date?: string }) => {
    const query = new URLSearchParams({ sport: next.sport ?? sport, date: next.date ?? date });
    const courtId = next.court === undefined ? court?.id : next.court;
    if (courtId) query.set('court', courtId);
    return `/book?${query}`;
  };

  const header = (
    <AppHeader
      back="/home"
      title={
        <>
          {t(lang, 'book.title')}
          <span className="block text-xs font-bold tracking-normal text-green-text">{t(lang, 'book.freeForVerified')}</span>
        </>
      }
    />
  );
  const sports = (
    <nav aria-label={t(lang, 'book.sports')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
      {SPORTS.map((s) => (
        <Link key={s} href={link({ sport: s, court: null })} aria-current={s === sport ? 'page' : undefined} className={chip(s === sport)}>
          <span aria-hidden="true">{SPORT_ICON[s]}</span> {t(lang, `book.sport.${s}`)}
        </Link>
      ))}
    </nav>
  );
  if (!court) {
    return (
      <>
        {header}
        <main className="flex flex-col gap-2.5 px-4 pt-3.5">
          {sports}
          <EmptyState icon="🏟️" title={t(lang, 'book.empty')} />
        </main>
      </>
    );
  }

  const [booked, mine, household] = await Promise.all([
    supabase.rpc('booked_slots', { p_facility: court.id, p_date: date }),
    supabase
      .from('bookings')
      .select('id, start_hour')
      .eq('user_id', profile.id)
      .eq('facility_id', court.id)
      .eq('date', date)
      .eq('status', 'booked')
      .overrideTypes<{ id: string; start_hour: number }[], { merge: false }>(),
    supabase.rpc('household_booked_hours', { p_date: date }),
  ]);
  for (const { error: e } of [booked, mine, household]) if (e) throw new Error(`slots lookup failed: ${e.message}`);
  const myBooking = new Map(mine.data!.map((b) => [b.start_hour, b.id]));
  const slots = slotStates(date, (booked.data ?? []) as number[], now).map((s) => ({
    ...s,
    label: slotLabel(date, s.hour, lang),
    range: slotRange(date, s.hour, lang),
    mine: myBooking.get(s.hour) ?? null,
  }));
  const other = courts.find((c) => c.id !== court.id) ?? null;
  // shortcut: "from you" is from the centre of the resident's neighbourhood (the app never knows where a home is); use the
  // device's location if residents want it closer.
  const me = neighbourhoodCentre(profile.neighbourhood);
  const metres = me && distanceMeters(me, court);
  const weekday = new Intl.DateTimeFormat(intlLocale(lang), { timeZone: TZ, weekday: 'short' });

  return (
    <>
      {header}
      {/* pb-10 and the layout's pb-24 keep the legend clear of the fixed Book bar. */}
      <main className="flex flex-col gap-2.5 px-4 pb-10 pt-3.5">
        {sports}
        {courts.length > 1 && (
          <nav aria-label={t(lang, 'book.courts')} className="flex rounded-xl bg-chip p-1">
            {courts.map((c) => (
              <Link key={c.id} href={link({ court: c.id })} aria-current={c.id === court.id ? 'page' : undefined} className={segment(c.id === court.id)}>
                {c.court_label}
              </Link>
            ))}
          </nav>
        )}

        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <MiniMap
            lat={court.lat}
            lng={court.lng}
            label={t(lang, 'book.map', { court: court.court_label, place: court.place_name })}
            also={other}
            me={me}
            pin="map-pin--place"
            className="h-28"
          />
          <div className="flex items-center justify-between gap-2 py-1.5 pl-3 pr-2">
            <p className="flex min-w-0 flex-col">
              <span className="break-words text-sm font-bold">
                <span aria-hidden="true">📍 </span>
                {court.place_name}
              </span>
              {metres !== null && (
                <span className="text-xs text-muted-2">
                  {t(lang, 'book.distance', { distance: formatDistance(metres), minutes: walkMinutes(metres) })}
                </span>
              )}
            </p>
            <Link href={`/map?walkTo=${court.id}`} className={`${buttonClasses('outline')} shrink-0`}>
              <span aria-hidden="true">🚶</span> {t(lang, 'book.directions')}
            </Link>
          </div>
        </section>

        <nav aria-label={t(lang, 'book.days')} className="grid grid-cols-7 gap-1.5">
          {dates.map((d) => {
            const on = d === date;
            const noon = slotStartUtc(d, 12);
            return (
              <Link
                key={d}
                href={link({ date: d })}
                aria-current={on ? 'page' : undefined}
                aria-label={eventDay(noon, lang)}
                className={`flex h-[62px] flex-col items-center justify-center gap-px rounded-xl border ${
                  on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface'
                }`}
              >
                <span className={`text-[0.6875rem] font-bold ${on ? '' : 'text-muted-2'}`}>{weekday.format(noon)}</span>
                <span className="text-base font-extrabold">{Number(d.slice(8))}</span>
              </Link>
            );
          })}
        </nav>

        <SlotPicker
          key={`${court.id} ${date}`}
          facilityId={court.id}
          date={date}
          slots={slots}
          hoursLeft={householdHoursLeft(Number(household.data ?? 0))}
          canAct={profile.status === 'verified'}
          summary={{
            icon: SPORT_ICON[court.sport],
            court: court.court_label,
            place: court.place_name,
            day: eventDay(slotStartUtc(date, 12), lang),
            township: profile.township.name,
            games: GAME_SPORTS.includes(court.sport),
          }}
        />
        <OpenGames profile={profile} lang={lang} />
      </main>
    </>
  );
}

/** My bookings (Me): the coming bookings, soonest first, each opening its pass. */
async function MyBookings({ profile, lang }: { profile: SessionProfile; lang: Lang }) {
  const supabase = await createClient();
  const now = new Date();
  const { data, error } = await supabase
    .from('bookings')
    .select(MY_BOOKING_COLUMNS)
    .eq('user_id', profile.id)
    .eq('status', 'booked')
    .gte('date', bookableDates(now)[0])
    .order('date')
    .order('start_hour')
    .overrideTypes<MyBooking[], { merge: false }>();
  if (error) throw new Error(`bookings lookup failed: ${error.message}`);
  // A booking is over an hour after it starts.
  const coming = data.filter((b) => slotStartUtc(b.date, b.start_hour + 1).getTime() > now.getTime());

  return (
    <>
      <AppHeader title={t(lang, 'me.bookings')} back="/me" />
      <main className="flex flex-col gap-3 px-4 py-4">
        {coming.length === 0 ? (
          <EmptyState
            icon="🏸"
            title={t(lang, 'book.mine.empty')}
            description={t(lang, 'book.mine.emptyHint')}
            action={
              <Link href="/book" className={buttonClasses('primary')}>
                {t(lang, 'book.again')}
              </Link>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {coming.map((b) => (
                <li key={b.id}>
                  <Link href={`/book/${b.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card hover:bg-soft">
                    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-orange text-2xl">
                      {SPORT_ICON[b.facility.sport]}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words font-bold">{b.facility.court_label}</span>
                      <span className="text-sm text-muted-2">
                        {eventDay(slotStartUtc(b.date, b.start_hour), lang)} · {slotRange(b.date, b.start_hour, lang)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/book" className={buttonClasses('outline')}>
              {t(lang, 'book.again')}
            </Link>
          </>
        )}
      </main>
    </>
  );
}
