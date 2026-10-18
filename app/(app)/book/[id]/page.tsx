import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { CancelBooking } from '@/components/book/CancelBooking';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { QR } from '@/components/ui/QR';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import {
  MY_BOOKING_COLUMNS,
  SPORT_ICON,
  canCancel,
  slotRange,
  slotStartUtc,
  spotsLabel,
  spotsLeft,
  type GamePlayer,
  type MyBooking,
} from '@/lib/domain/booking';
import { eventDay, eventTime } from '@/lib/domain/events';
import { isUuid } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

const HOUR = 3_600_000;

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'book.pass.title') };
}

/**
 * The booking pass (canvas "3 · Booking pass"): the court and the hour, a QR and booking number to show if asked, who
 * joined a game that needs players and the spots left, Add to calendar (.ics) and Cancel, free until 2 hours before. A
 * cancelled or finished booking says so instead.
 */
export default async function BookingPassPage({ params }: PageProps<'/book/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: b, error } = await supabase
    .from('bookings')
    .select(MY_BOOKING_COLUMNS)
    .eq('id', id)
    .eq('user_id', profile.id)
    .maybeSingle()
    .overrideTypes<MyBooking, { merge: false }>();
  if (error) throw new Error(`booking lookup failed: ${error.message}`);
  if (!b) notFound();
  const now = new Date();
  const start = slotStartUtc(b.date, b.start_hour);
  const live = b.status === 'booked' && start.getTime() + HOUR > now.getTime();
  const free = live && canCancel(b.date, b.start_hour, now);
  const cancelBy = new Date(start.getTime() - 2 * HOUR);
  let players: GamePlayer[] = [];
  if (live && b.players_needed > 0) {
    const found = await supabase.rpc('game_players', { p_booking: b.id });
    if (found.error) throw new Error(`players lookup failed: ${found.error.message}`);
    players = (found.data ?? []) as GamePlayer[];
  }
  const left = spotsLeft(b.players_needed, players.length);

  return (
    <>
      <AppHeader title={t(lang, 'book.pass.title')} back="/book?view=mine" />
      <main className="flex flex-col gap-3 px-4 py-4">
        <section className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-lg">
          {/* Only large, bold text on the gradient. */}
          <p className={live ? 'bg-brand-gradient px-4 py-3 text-xl font-extrabold text-white' : 'bg-chip px-4 py-3 text-base font-extrabold text-muted-2'}>
            {t(lang, live ? 'book.pass.confirmed' : b.status === 'cancelled' ? 'book.pass.cancelled' : 'book.pass.ended')}
          </p>
          <div className="flex flex-col items-center gap-1 px-4 pb-5 pt-4 text-center">
            <h2 className="break-words text-[1.375rem] font-extrabold leading-tight">
              <span aria-hidden="true"><Glyph emoji={SPORT_ICON[b.facility.sport]} /> </span>
              {b.facility.court_label}
            </h2>
            <p className="text-[0.9375rem] font-bold">
              {eventDay(start, lang)} · {slotRange(b.date, b.start_hour, lang)}
            </p>
            <p className="text-sm text-muted-2">{b.facility.place_name}</p>
            {live && <QR value={`booking:${b.id}`} label={t(lang, 'book.pass.qr')} size={168} className="mb-1.5 mt-3" />}
            <p className="text-xs text-muted-2">{t(lang, 'book.pass.number', { n: b.id.slice(0, 6).toUpperCase() })}</p>
          </div>
        </section>

        {live && b.players_needed > 0 && (
          <section aria-labelledby="players-title" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="players-title" className="text-[0.9375rem] font-bold">
                <span aria-hidden="true"><Glyph emoji="🙋" /> </span>
                {t(lang, left > 0 ? 'book.game.finding' : 'book.game.found')}
              </h2>
              <Tag variant={left > 0 ? 'amber' : 'green'}>{spotsLabel(left, lang)}</Tag>
            </div>
            {players.length === 0 ? (
              <p className="text-sm text-muted-2">{t(lang, 'book.game.none')}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {players.map((p) => (
                  <li key={`${p.full_name} ${p.joined_at}`} className="flex items-center gap-2.5">
                    <Avatar name={p.full_name} size={36} />
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words text-sm font-bold">{t(lang, 'book.game.joinedBy', { name: p.full_name })}</span>
                      <span className="text-xs text-muted-2">
                        {p.neighbourhood} · <TimeAgo date={p.joined_at} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-2">{t(lang, 'book.game.shown')}</p>
          </section>
        )}

        {live ? (
          <>
            <div className="grid grid-cols-2 items-start gap-2">
              <a href={`/book/${b.id}/ics`} download className={buttonClasses('outline')}>
                <Glyph emoji="📅" /> {t(lang, 'book.pass.calendar')}
              </a>
              {free ? (
                <CancelBooking id={b.id} />
              ) : (
                <button type="button" disabled aria-describedby="cancel-note" className={`${buttonClasses('outline')} w-full`}>
                  {t(lang, 'book.cancel')}
                </button>
              )}
            </div>
            <p id="cancel-note" className="text-center text-xs text-muted-2">
              {free
                ? t(lang, 'book.pass.freeUntil', { time: eventTime(cancelBy, lang), day: eventDay(cancelBy, lang) })
                : t(lang, 'book.error.tooLate')}
            </p>
          </>
        ) : (
          <Link href="/book" className={buttonClasses('outline')}>
            {t(lang, 'book.again')}
          </Link>
        )}
      </main>
    </>
  );
}
