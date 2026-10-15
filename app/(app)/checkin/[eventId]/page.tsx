import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { buttonClasses } from '@/components/ui/Button';
import { checkinErrorKey, eventTime } from '@/lib/domain/events';
import { isUuid } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile, requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'checkin.title') };
}

/**
 * Where the event's QR leads (`/checkin/<event>?c=<code>`, scanned with the phone's own camera). Opening it checks the
 * resident in: check_in_event decides (verified, right code, approved event, inside the window, not twice) and adds
 * the points. A second visit only says "already checked in", so a reload or a second scan changes nothing.
 */
export default async function CheckinPage({ params, searchParams }: PageProps<'/checkin/[eventId]'>) {
  const { eventId } = await params;
  const code = (await searchParams).c;
  if (!(await getSessionProfile())) {
    // Back here after signing in (proxy.ts usually does this first).
    redirect(`/?next=${encodeURIComponent(`/checkin/${eventId}?c=${typeof code === 'string' ? code : ''}`)}`);
  }
  await requireMember();
  const lang = await getLang();
  const supabase = await createClient();

  const valid = isUuid(eventId) && typeof code === 'string';
  const checkin = valid
    ? await supabase.rpc('check_in_event', { p_event: eventId, p_code: code })
    : { data: null, error: { message: 'bad_code' } };
  if (checkin.error && checkinErrorKey(checkin.error.message) === 'common.error') {
    console.error(`check_in_event failed: ${checkin.error.message}`);
  }
  // After the check-in, so its time is there. Someone else's township's event is simply not found.
  const { data: event } = valid
    ? await supabase.from('public_events').select('id, title, checked_in_at').eq('id', eventId).maybeSingle()
    : { data: null };

  const done = !checkin.error;
  const already = checkin.error?.message === 'already_checked_in';
  const at = event?.checked_in_at ? eventTime(new Date(event.checked_in_at), lang) : null;

  return (
    <>
      <AppHeader title={t(lang, 'checkin.title')} back="/community?tab=events" />
      <main className="grid px-4 py-8">
        <div role="status" className="grid justify-items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
          <span
            aria-hidden="true"
            className={`grid size-16 place-items-center rounded-full text-3xl font-extrabold ${
              done || already ? 'bg-tint-green text-green-text' : 'bg-tint-red text-red-text'
            }`}
          >
            {done || already ? '✓' : '✗'}
          </span>
          {done ? (
            <>
              <h1 className="text-xl font-extrabold">{t(lang, 'checkin.done', { time: at ?? '' })}</h1>
              <p className="text-3xl font-extrabold text-green-text">{t(lang, 'checkin.points', { n: Number(checkin.data) })}</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold">{t(lang, already ? 'checkin.title' : 'checkin.failed')}</h1>
              <p className="text-base">{t(lang, checkinErrorKey(checkin.error?.message))}</p>
            </>
          )}
          {event && (
            <>
              <p className="break-words font-bold">{event.title}</p>
              <Link href={`/community/events/${event.id}`} className={buttonClasses('outline')}>
                {t(lang, 'checkin.toEvent')}
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
