import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { BackButton } from '@/components/app/BackButton';
import { HeroChip } from '@/components/app/HeroChip';
import { CheckinQrSheet } from '@/components/events/CheckinQrSheet';
import { GoingButton } from '@/components/events/GoingButton';
import { eventTags } from '@/components/events/eventTags';
import { QR } from '@/components/ui/QR';
import { EVENT_ICON, PUBLIC_EVENT_COLUMNS, eventDay, eventTime, type PublicEvent } from '@/lib/domain/events';
import { isUuid } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** The event through the privacy view (no check-in code), shared by the page and its title. */
const getEvent = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_events')
    .select(PUBLIC_EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<PublicEvent, { merge: false }>();
  if (error) throw new Error(`event lookup failed: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<'/community/events/[id]'>): Promise<Metadata> {
  const [lang, event] = await Promise.all([getLang(), getEvent((await params).id)]);
  return { title: event?.title ?? t(lang, 'community.tab.events') };
}

/** This site's address as the visitor reached it, so the QR opens the same deployment (Vercel sets the forwarded headers). */
async function siteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-soft p-3">
      <dt className="text-xs font-bold text-muted-2">{label}</dt>
      <dd className="text-sm font-extrabold">{children}</dd>
    </div>
  );
}

/**
 * One event (brainstorm "Events" phone): what and who, the facts, Going, and either the check-in QR (organiser and
 * Management Office) or how to check in at the venue (everyone else).
 */
export default async function EventPage({ params }: PageProps<'/community/events/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const now = new Date();
  const starts = new Date(event.starts_at);
  const ended = Date.parse(event.ends_at) <= now.getTime();
  const verified = profile.status === 'verified';
  // The organiser and the Management Office hold up the QR; event_checkin_url refuses anyone else anyway.
  let checkinUrl: string | null = null;
  if (!ended && (event.is_mine || profile.role === 'management')) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('event_checkin_url', { p_event: event.id });
    if (error) console.error(`event_checkin_url failed: ${error.message}`);
    else checkinUrl = `${await siteOrigin()}${data}`;
  }

  return (
    <>
      {/* Only large, bold text on the gradient; the small lines sit on white chips. */}
      <header className="bg-brand-gradient px-4 pb-6 pt-4 text-white">
        <BackButton fallback="/community?tab=events" tone="overlay" />
        <p className="mt-4 flex flex-wrap gap-2">
          {eventTags(event, lang).map((tag) => (
            <HeroChip key={tag.text}>{tag.text}</HeroChip>
          ))}
        </p>
        <h1 className="mt-3 break-words text-2xl font-extrabold leading-tight">{event.title}</h1>
        <p className="mt-3 flex flex-wrap gap-2">
          <HeroChip>{event.organizer_name ? t(lang, 'event.organisedBy', { name: event.organizer_name }) : t(lang, 'event.byOffice')}</HeroChip>
          {!event.is_official && event.approval_status === 'approved' && <HeroChip>{t(lang, 'event.approvedBy')}</HeroChip>}
        </p>
      </header>

      <main className="grid gap-4 px-4 py-4">
        <dl className="grid grid-cols-2 gap-2">
          <Fact label={t(lang, 'event.when')}>
            {eventDay(starts, lang)} · {eventTime(starts, lang)}
          </Fact>
          <Fact label={t(lang, 'event.where')}>{event.location_text}</Fact>
          <Fact label={t(lang, 'event.whoGoing')}>{t(lang, 'event.neighbours', { n: event.going_count })}</Fact>
          <Fact label={t(lang, 'event.categoryLabel')}>
            <span aria-hidden="true">{EVENT_ICON[event.category]}</span> {t(lang, `event.category.${event.category}`)}
          </Fact>
        </dl>

        {event.description && <p className="whitespace-pre-line break-words text-base">{event.description}</p>}

        {event.checked_in_at ? (
          <p className="rounded-xl bg-tint-green px-3 py-2.5 text-center text-sm font-extrabold text-green-text">
            {t(lang, 'event.checkedIn', { time: eventTime(new Date(event.checked_in_at), lang), n: event.points })}
          </p>
        ) : ended ? (
          <p className="rounded-xl bg-soft px-3 py-2.5 text-center text-sm font-bold">{t(lang, 'event.ended')}</p>
        ) : (
          <GoingButton eventId={event.id} title={event.title} going={event.is_going} canAct={verified} big />
        )}
        {!verified && !ended && <p className="text-sm text-muted-2">{t(lang, 'common.pendingCantAct')}</p>}

        {event.is_mine && !ended && (event.approval_status === 'pending' || event.approval_status === 'rejected') && (
          <p className="rounded-xl bg-tint-blue px-3 py-2.5 text-sm">{t(lang, `event.status.${event.approval_status}`)}</p>
        )}

        {checkinUrl ? (
          <CheckinQrSheet>
            <div className="grid justify-items-center gap-4 py-4 text-center">
              <p className="text-xl font-extrabold">{event.title}</p>
              <QR value={checkinUrl} label={t(lang, 'event.qr.label', { title: event.title })} size={280} />
              <p className="max-w-sm text-sm text-muted-2">{t(lang, event.points > 0 ? 'event.qr.hint' : 'event.qr.noPoints')}</p>
            </div>
          </CheckinQrSheet>
        ) : (
          !ended &&
          event.points > 0 &&
          !event.checked_in_at && (
            <div className="grid gap-1 rounded-xl border-2 border-dashed border-orange bg-tint-orange px-3 py-3 text-center">
              <p className="text-base font-extrabold">
                <span aria-hidden="true">📷</span> {t(lang, 'event.scan.title')}
              </p>
              <p className="text-sm text-muted-2">{t(lang, 'event.scan.body', { n: event.points })}</p>
            </div>
          )
        )}

        <p className="text-center text-xs text-muted-2">{t(lang, 'event.pointsNote')}</p>
      </main>
    </>
  );
}
