import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/app/AppHeader';
import { LiveTopics } from '@/components/topics/LiveTopic';
import { Tag } from '@/components/ui/Tag';
import { timeAgo } from '@/lib/domain/time';
import { PUBLIC_TOPIC_COLUMNS, type PublicTopic } from '@/lib/domain/topics';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'general.title') };
}

/**
 * General chat as a Telegram-style community: its topics, each with its latest message and the reader's unread count,
 * then the group's rules. Everyone in the township reads; the list follows new messages live.
 */
export default async function GeneralChatPage() {
  const profile = await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  const [group, topics] = await Promise.all([
    supabase.from('public_groups').select('member_count, rules').eq('is_general', true).maybeSingle(),
    supabase
      .from('public_topics')
      .select(PUBLIC_TOPIC_COLUMNS)
      .order('sort_order')
      .order('title')
      .overrideTypes<PublicTopic[], { merge: false }>(),
  ]);
  for (const { error } of [group, topics]) if (error) throw new Error(`General chat lookup failed: ${error.message}`);
  if (!group.data) notFound();
  const now = new Date();

  return (
    <>
      <AppHeader
        title={
          <>
            <span aria-hidden="true">💬 </span>
            {t(lang, 'general.title')}
            <span className="block text-xs font-semibold tracking-normal text-muted-2">
              {profile.township.name} · {t(lang, 'group.members', { n: group.data.member_count })}
            </span>
          </>
        }
        back="/community?tab=groups"
      />
      <LiveTopics />
      <main className="grid gap-4 px-4 py-4">
        <ul aria-label={t(lang, 'general.topics')} className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {topics.data!.map((topic) => (
            <li key={topic.id}>
              <Link href={`/community/general/${topic.id}`} className="flex min-h-16 items-center gap-3 px-3.5 py-3 hover:bg-soft">
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-tint-amber text-2xl">
                  {topic.emoji}
                </span>
                {/* The name has the row's full width (the time sits on the preview line), so large text never splits a word. */}
                {/* grid-cols-1 (minmax(0, 1fr)): the preview line truncates instead of stretching the row. */}
                <span className="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="min-w-0 break-words font-bold">{topic.title}</span>
                    {topic.office_only && (
                      <Tag variant="amber" className="shrink-0">
                        🔒 {t(lang, 'general.officeOnly')}
                      </Tag>
                    )}
                  </span>
                  <span className="flex items-baseline gap-2 text-sm text-muted-2">
                    <span className="min-w-0 flex-1 truncate">
                      {topic.last_body ? `${topic.last_sender ?? t(lang, 'general.someone')}: ${topic.last_body}` : t(lang, 'general.noMessages')}
                    </span>
                    {topic.last_at && <span className="shrink-0 text-xs font-semibold">{timeAgo(new Date(topic.last_at), now, lang)}</span>}
                  </span>
                </span>
                {topic.unread_count > 0 && (
                  <span className="grid min-w-6 shrink-0 place-items-center rounded-full bg-red px-1.5 py-0.5 text-xs font-extrabold text-white">
                    {topic.unread_count}
                    <span className="sr-only"> {t(lang, 'group.new', { n: topic.unread_count })}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {group.data.rules && (
          <section aria-labelledby="general-rules" className="grid gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <h2 id="general-rules" className="text-sm font-extrabold uppercase tracking-wide text-muted">
              {t(lang, 'group.tab.rules')}
            </h2>
            <p className="whitespace-pre-line text-sm">{group.data.rules}</p>
          </section>
        )}
      </main>
    </>
  );
}
