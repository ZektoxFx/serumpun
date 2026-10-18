import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { AppHeader } from '@/components/app/AppHeader';
import { LiveTopic } from '@/components/topics/LiveTopic';
import { TopicComposer } from '@/components/topics/TopicComposer';
import { isUuid } from '@/lib/domain/reports';
import { clockTime } from '@/lib/domain/time';
import { PUBLIC_TOPIC_COLUMNS, TOPIC_MESSAGE_COLUMNS, type PublicTopic, type TopicMessage } from '@/lib/domain/topics';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** The topic, if it is one of the reader's township's General chat, shared by the page and its title. */
const getTopic = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_topics')
    .select(PUBLIC_TOPIC_COLUMNS)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<PublicTopic, { merge: false }>();
  if (error) throw new Error(`topic lookup failed: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<'/community/general/[topic]'>): Promise<Metadata> {
  const [lang, topic] = await Promise.all([getLang(), getTopic((await params).topic)]);
  return { title: topic?.title ?? t(lang, 'general.title') };
}

/**
 * One topic of General chat, a live group chat: everyone's messages with their names (the office's marked), the
 * reader's own on the right, and the message box where the navigation bar would be (the bar hides here). Opening it
 * marks it read.
 */
export default async function TopicPage({ params }: PageProps<'/community/general/[topic]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const topic = await getTopic((await params).topic);
  if (!topic) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_topic_messages')
    .select(TOPIC_MESSAGE_COLUMNS)
    .eq('topic_id', topic.id)
    .order('created_at', { ascending: false })
    .limit(100) // shortcut: the latest 100 messages; add "older messages" once a topic runs longer
    .overrideTypes<TopicMessage[], { merge: false }>();
  if (error) throw new Error(`topic messages lookup failed: ${error.message}`);
  const messages = data.reverse();
  const now = new Date();
  const blocked =
    profile.status !== 'verified'
      ? 'common.pendingCantAct'
      : topic.office_only && profile.role !== 'management'
        ? 'general.error.officeOnly'
        : null;
  const name = (m: TopicMessage) => (m.from_office ? `${t(lang, 'role.management')} ✓` : (m.sender_name ?? t(lang, 'general.someone')));

  return (
    <>
      <AppHeader
        title={
          <>
            <span aria-hidden="true">{topic.emoji} </span>
            {topic.title}
            <span className="block text-xs font-semibold tracking-normal text-muted-2">
              {t(lang, 'general.title')}
              {topic.office_only && ` · 🔒 ${t(lang, 'general.officeOnly')}`}
            </span>
          </>
        }
        back="/community/general"
      />
      <LiveTopic topicId={topic.id} last={messages.at(-1)?.id ?? null} unread={topic.unread_count} />
      <main className="flex flex-col gap-3 px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-muted-2">{t(lang, 'general.emptyTopic')}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {messages.map((m, i) => {
              // A name heads each run of someone else's messages, as in a group chat.
              const showName = !m.is_mine && (i === 0 || messages[i - 1].is_mine || name(messages[i - 1]) !== name(m));
              return (
                <li key={m.id} className={`flex flex-col ${m.is_mine ? 'items-end' : 'items-start'}`}>
                  {showName && (
                    <span className={`px-1 text-xs font-extrabold ${m.from_office ? 'text-red-text' : 'text-muted'}`} aria-hidden="true">
                      {name(m)}
                    </span>
                  )}
                  <p
                    className={`max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 ${
                      m.is_mine ? 'rounded-br-md bg-ink text-on-ink' : 'rounded-bl-md border border-line bg-surface'
                    }`}
                  >
                    <span className="sr-only">{m.is_mine ? t(lang, 'messages.you') : `${name(m)}: `}</span>
                    {m.body}
                  </p>
                  <span className="mt-0.5 px-1 text-xs text-muted-2">{clockTime(new Date(m.created_at), now, lang)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </main>
      <TopicComposer topicId={topic.id} title={topic.title} blocked={blocked} />
    </>
  );
}
