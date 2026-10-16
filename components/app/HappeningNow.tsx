import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { ALERT_ICON, PUBLIC_ALERT_COLUMNS, nearestAlert, type PublicAlert } from '@/lib/domain/alerts';
import { PUBLIC_EVENT_COLUMNS, eventDay, eventTime, type PublicEvent } from '@/lib/domain/events';
import { distanceMeters, formatDistance } from '@/lib/domain/geo';
import { nearestPlace, neighbourhoodCentre } from '@/lib/domain/places';
import { t, type Lang } from '@/lib/i18n';
import type { SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

type Announcement = { id: string; title: string; body: string; created_at: string };

/** Older announcements are no longer "happening now". */
const ANNOUNCEMENT_DAYS = 14;

const card = 'flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-3.5 shadow-card';
// The brainstorm's tags: capitals for the kind, normal case for the rest ("ALERT · 200 m away").
const tag = 'rounded-md px-2 py-0.5 text-xs font-extrabold';

/**
 * Home's "Happening now" (brainstorm Home A): the live neighbour alert nearest the reader's neighbourhood (else the
 * township's centre), the Management Office's latest announcement, and the reader's next event, else the next one on.
 * The alert and the event open their screens; the announcement opens in place.
 */
export async function HappeningNow({ profile, lang }: { profile: SessionProfile; lang: Lang }) {
  const supabase = await createClient();
  const now = new Date();
  const [alerts, notices, events] = await Promise.all([
    supabase.from('public_alerts').select(PUBLIC_ALERT_COLUMNS).overrideTypes<PublicAlert[], { merge: false }>(),
    supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .gte('created_at', new Date(now.getTime() - ANNOUNCEMENT_DAYS * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .overrideTypes<Announcement[], { merge: false }>(),
    supabase
      .from('public_events')
      .select(PUBLIC_EVENT_COLUMNS)
      .gt('ends_at', now.toISOString())
      .order('starts_at')
      .limit(20)
      .overrideTypes<PublicEvent[], { merge: false }>(),
  ]);
  for (const { error } of [alerts, notices, events]) if (error) throw new Error(`happening now lookup failed: ${error.message}`);
  const from = neighbourhoodCentre(profile.neighbourhood) ?? { lat: profile.township.centre_lat, lng: profile.township.centre_lng };
  const alert = nearestAlert(alerts.data!, from, now);
  const [notice] = notices.data!;
  const event = events.data!.find((e) => e.is_going) ?? events.data![0];

  return (
    <section aria-labelledby="happening-now" className="grid gap-2">
      <h2 id="happening-now" className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
        {t(lang, 'home.happening')}
      </h2>
      {alert && <AlertCard alert={alert} from={from} lang={lang} />}
      {notice && (
        <details className="group rounded-2xl border border-line bg-surface shadow-card">
          <summary className="flex cursor-pointer list-none flex-col items-start gap-1 rounded-2xl p-3.5 [&::-webkit-details-marker]:hidden">
            <span className={`${tag} bg-tint-blue text-text`}>📢 {t(lang, 'home.office.tag')}</span>
            <span className="break-words font-bold">{notice.title}</span>
            <span className="line-clamp-3 whitespace-pre-line break-words text-sm group-open:line-clamp-none">{notice.body}</span>
            <TimeAgo date={notice.created_at} className="text-xs text-muted-2" />
          </summary>
        </details>
      )}
      {event && <EventCard event={event} lang={lang} />}
      {!alert && !notice && !event && (
        <EmptyState
          icon="🌿"
          title={t(lang, 'home.happening.empty')}
          description={t(lang, 'home.happening.emptyHint')}
          action={
            <Link href="/map" className={buttonClasses('outline')}>
              {t(lang, 'home.tile.map')}
            </Link>
          }
        />
      )}
    </section>
  );
}

/** "⚠ ALERT · 380 m away", what and where, and how fresh: opens the map on it. */
function AlertCard({ alert, from, lang }: { alert: PublicAlert; from: { lat: number; lng: number }; lang: Lang }) {
  const place = nearestPlace(alert);
  const type = t(lang, `alert.type.${alert.type}`);
  const confirmed = alert.confirm_count;
  return (
    <Link href={`/map?alert=${alert.id}`} className={`${card} hover:bg-soft`}>
      <span className={`${tag} bg-tint-orange text-orange-text`}>
        ⚠ {t(lang, 'home.alert.tag', { distance: formatDistance(distanceMeters(from, alert)) })}
      </span>
      <span className="break-words font-bold">
        <span aria-hidden="true">{ALERT_ICON[alert.type]} </span>
        {place ? t(lang, 'home.alert.title', { type, place: t(lang, place.label) }) : type}
      </span>
      <span className="text-sm text-muted-2">
        <TimeAgo date={confirmed > 0 ? alert.last_confirmed_at : alert.created_at} />
        {confirmed > 0 && ` · ${t(lang, confirmed === 1 ? 'home.alert.confirmedOne' : 'home.alert.confirmedMany', { n: confirmed })}`}
      </span>
    </Link>
  );
}

/** "📅 EVENT · +150 points", the title and when and where, and "You're going": opens the event. */
function EventCard({ event, lang }: { event: PublicEvent; lang: Lang }) {
  const start = new Date(event.starts_at);
  const points = event.is_official || event.approval_status === 'approved' ? event.points : 0;
  return (
    <Link href={`/community/events/${event.id}`} className={`${card} hover:bg-soft`}>
      <span className={`${tag} bg-tint-amber text-amber-text`}>
        📅 {points > 0 ? t(lang, 'home.event.points', { n: points }) : t(lang, 'home.event.tag')}
      </span>
      <span className="break-words font-bold">{event.title}</span>
      <span className="break-words text-sm text-muted-2">
        {eventDay(start, lang)} · {eventTime(start, lang)} · {event.location_text}
      </span>
      {event.is_going && <span className="text-sm font-bold text-green-text">{t(lang, 'event.youreGoing')}</span>}
    </Link>
  );
}
