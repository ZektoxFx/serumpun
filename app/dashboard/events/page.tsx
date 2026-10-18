import type { Metadata } from 'next';
import Link from 'next/link';
import { EventDecision } from '@/components/dashboard/EventDecision';
import { EventForm } from '@/components/events/EventForm';
import { eventTags } from '@/components/events/eventTags';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import { EVENT_ICON, PUBLIC_EVENT_COLUMNS, eventDay, eventTime, type PublicEvent } from '@/lib/domain/events';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.events') };
}

/**
 * Events: resident events waiting for points (approve with points, or reject), a form for the office's own official
 * events, and the upcoming ones, each opening its page (where the office shows the check-in QR).
 */
export default async function DashboardEventsPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from('public_events')
    .select(PUBLIC_EVENT_COLUMNS)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .overrideTypes<PublicEvent[], { merge: false }>();
  if (error) throw new Error(`events lookup failed: ${error.message}`);
  const waiting = events.filter((e) => e.approval_status === 'pending');
  const when = (e: PublicEvent) => `${eventDay(new Date(e.starts_at), lang)} · ${eventTime(new Date(e.starts_at), lang)} · ${e.location_text}`;

  return (
    <main className="grid gap-6 p-4 sm:p-6 xl:grid-cols-2 xl:items-start">
      <h1 className="text-2xl font-extrabold xl:col-span-2">{t(lang, 'dashboard.nav.events')}</h1>

      <section aria-labelledby="waiting-events" className="grid min-w-0 gap-3">
        <h2 id="waiting-events" className="text-base font-extrabold">
          {t(lang, 'dashboard.events.waiting')}
        </h2>
        {waiting.length === 0 ? (
          <EmptyState icon="📅" title={t(lang, 'dashboard.events.empty')} />
        ) : (
          <ul className="grid gap-2">
            {waiting.map((e) => (
              <li key={e.id} className="grid gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <p className="break-words font-extrabold">
                  <Glyph emoji={EVENT_ICON[e.category]} /> {e.title}
                </p>
                <p className="text-sm text-muted-2">
                  {e.organizer_name && `${t(lang, 'event.organisedBy', { name: e.organizer_name })} · `}
                  {when(e)} · {t(lang, 'event.goingCount', { n: e.going_count })}
                </p>
                {e.description && <p className="whitespace-pre-line break-words text-sm">{e.description}</p>}
                <EventDecision id={e.id} title={e.title} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="new-official-event" className="grid min-w-0 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 id="new-official-event" className="text-base font-extrabold">
          {t(lang, 'dashboard.events.new')}
        </h2>
        <EventForm official canPost />
      </section>

      <section aria-labelledby="upcoming-events" className="grid min-w-0 gap-3 xl:col-span-2">
        <h2 id="upcoming-events" className="text-base font-extrabold">
          {t(lang, 'dashboard.events.upcoming')}
        </h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {events
            .filter((e) => e.approval_status !== 'pending')
            .map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="flex flex-wrap gap-1">
                    {eventTags(e, lang).map((tag) => (
                      <Tag key={tag.text} variant={tag.variant}>
                        {tag.text}
                      </Tag>
                    ))}
                  </p>
                  <p className="break-words font-extrabold">{e.title}</p>
                  <p className="text-sm text-muted-2">
                    {when(e)} · {t(lang, 'event.goingCount', { n: e.going_count })}
                  </p>
                </div>
                <Link href={`/community/events/${e.id}`} className={`${buttonClasses('outline')} shrink-0`}>
                  {t(lang, 'dashboard.events.open')}
                  <span className="sr-only"> {e.title}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}
