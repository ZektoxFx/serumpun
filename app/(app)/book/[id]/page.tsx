import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { CancelBooking } from '@/components/book/CancelBooking';
import { buttonClasses } from '@/components/ui/Button';
import { QR } from '@/components/ui/QR';
import { MY_BOOKING_COLUMNS, SPORT_ICON, canCancel, slotRange, slotStartUtc, type MyBooking } from '@/lib/domain/booking';
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
 * The booking pass (canvas "3 · Booking pass"): the court and the hour, a QR and booking number to show if asked, Add to
 * calendar (.ics) and Cancel, free until 2 hours before. A cancelled or finished booking says so instead.
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
            <h2 className="break-words text-[22px] font-extrabold leading-tight">
              <span aria-hidden="true">{SPORT_ICON[b.facility.sport]} </span>
              {b.facility.court_label}
            </h2>
            <p className="text-[15px] font-bold">
              {eventDay(start, lang)} · {slotRange(b.date, b.start_hour, lang)}
            </p>
            <p className="text-sm text-muted-2">{b.facility.place_name}</p>
            {live && <QR value={`booking:${b.id}`} label={t(lang, 'book.pass.qr')} size={168} className="mb-1.5 mt-3" />}
            <p className="text-xs text-muted-2">{t(lang, 'book.pass.number', { n: b.id.slice(0, 6).toUpperCase() })}</p>
          </div>
        </section>

        {live ? (
          <>
            <div className="grid grid-cols-2 items-start gap-2">
              <a href={`/book/${b.id}/ics`} download className={buttonClasses('outline')}>
                <span aria-hidden="true">📅</span> {t(lang, 'book.pass.calendar')}
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
