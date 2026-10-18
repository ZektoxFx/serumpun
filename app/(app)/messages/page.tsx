import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { LiveMessages } from '@/components/app/LiveMessages';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { CONTEXT_ICON, CONVERSATION_COLUMNS, type Conversation } from '@/lib/domain/messages';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'messages.title') };
}

/**
 * The inbox (spec §8.8): each conversation with the other person's name and neighbourhood (never a unit or a phone),
 * what it is about, the latest message and an unread dot, newest first, kept live.
 */
export default async function MessagesPage() {
  await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: chats, error } = await supabase
    .from('my_conversations')
    .select(CONVERSATION_COLUMNS)
    .order('last_message_at', { ascending: false })
    .overrideTypes<Conversation[], { merge: false }>();
  if (error) throw new Error(`conversations lookup failed: ${error.message}`);

  return (
    <>
      <AppHeader title={t(lang, 'messages.title')} back="/home" />
      <LiveMessages />
      <main className="grid grid-cols-1 gap-3 px-4 py-4">
        {chats.length === 0 ? (
          <EmptyState
            icon="💬"
            title={t(lang, 'messages.empty')}
            description={t(lang, 'messages.emptyHint')}
            action={
              <Link href="/community?tab=services" className={buttonClasses('primary')}>
                {t(lang, 'community.tab.services')}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {chats.map((c) => {
              const unread = c.unread_count > 0;
              return (
                // The row fills an overflow-hidden, rounded list: inset focus ring, and the list's corners passed down.
                <li key={c.id} className="first:rounded-t-[inherit] last:rounded-b-[inherit]">
                  <Link
                    href={`/messages/${c.id}`}
                    className={`flex items-start gap-3 rounded-[inherit] px-4 py-3 hover:bg-soft focus-visible:outline-offset-[-2px] ${unread ? 'bg-tint-blue' : ''}`}
                  >
                    <Avatar name={c.other_name} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 break-words ${unread ? 'font-extrabold' : 'font-bold'}`}>{c.other_name}</span>
                        <TimeAgo date={c.last_message_at} className="shrink-0 text-xs text-muted-2" />
                      </span>
                      <span className="block text-xs text-muted-2">{c.other_neighbourhood}</span>
                      <span className="mt-1 block break-words text-xs font-bold text-muted-2">
                        <span aria-hidden="true"><Glyph emoji={CONTEXT_ICON[c.context_type]} /> </span>
                        {c.context_title}
                      </span>
                      <span className={`mt-0.5 line-clamp-2 break-words text-sm ${unread ? 'font-bold text-text' : 'text-muted-2'}`}>
                        {c.last_is_mine && t(lang, 'messages.you')}
                        {c.last_body}
                      </span>
                    </span>
                    {unread && (
                      <span className="mt-2 size-2.5 shrink-0 rounded-full bg-red">
                        <span className="sr-only">{t(lang, 'messages.unread', { n: c.unread_count })}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
