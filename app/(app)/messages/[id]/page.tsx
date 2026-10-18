import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { AppHeader } from '@/components/app/AppHeader';
import { LiveThread } from '@/components/messages/LiveThread';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { RateService } from '@/components/services/RateService';
import { Glyph } from '@/components/ui/Glyph';
import { CONTEXT_ICON, CONVERSATION_COLUMNS, type Conversation } from '@/lib/domain/messages';
import { isUuid } from '@/lib/domain/reports';
import { clockTime } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** The conversation, if the caller is in it, shared by the page and its title. */
const getConversation = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<Conversation, { merge: false }>();
  if (error) throw new Error(`conversation lookup failed: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<'/messages/[id]'>): Promise<Metadata> {
  const [lang, chat] = await Promise.all([getLang(), getConversation((await params).id)]);
  return { title: chat?.other_name ?? t(lang, 'messages.title') };
}

/**
 * One conversation (spec §8.8): who it is with, a card with what it is about (and Rate, for the client of an offer), the
 * messages, and the composer where the navigation bar would be (the bar hides here). New messages arrive live; opening
 * it marks it read.
 */
export default async function ConversationPage({ params }: PageProps<'/messages/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const chat = await getConversation((await params).id);
  if (!chat) notFound();
  const supabase = await createClient();
  // Row-level security: only the conversation's two members read its messages.
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', chat.id)
    .order('created_at', { ascending: false })
    .limit(100); // shortcut: the latest 100 messages; add "older messages" if a conversation ever runs longer
  if (error) throw new Error(`messages lookup failed: ${error.message}`);
  const messages = data.reverse();
  const now = new Date();
  // About someone else's offer: the client can rate it (with the stars they gave, if any).
  let rate: { serviceId: string; rating: number | null } | null = null;
  if (chat.context_type === 'service' && chat.context_id) {
    const [service, mine] = await Promise.all([
      supabase.from('public_services').select('kind, is_mine').eq('id', chat.context_id).maybeSingle(),
      supabase.from('public_service_ratings').select('rating').eq('service_id', chat.context_id).eq('is_mine', true).maybeSingle(),
    ]);
    for (const { error: e } of [service, mine]) if (e) throw new Error(`rating lookup failed: ${e.message}`);
    if (service.data?.kind === 'offer' && !service.data.is_mine) rate = { serviceId: chat.context_id, rating: mine.data?.rating ?? null };
  }

  return (
    <>
      <AppHeader
        title={
          <>
            {chat.other_name}{' '}
            <span className="block text-xs font-semibold tracking-normal text-muted-2">{chat.other_neighbourhood}</span>
          </>
        }
        back="/messages"
      />
      <LiveThread conversationId={chat.id} last={messages.at(-1)?.id ?? null} unread={chat.unread_count} />
      <main className="flex flex-col gap-3 px-4 py-4">
        <section className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            {t(lang, 'messages.about')} · {t(lang, `messages.context.${chat.context_type}`)}
          </p>
          <p className="mt-1 break-words font-bold">
            <span aria-hidden="true"><Glyph emoji={CONTEXT_ICON[chat.context_type]} /> </span>
            {chat.context_title}
          </p>
          <p className="mt-2 text-xs text-muted-2">
            <span aria-hidden="true"><Glyph emoji="🔒" /> </span>
            {t(lang, 'messages.privacy')}
          </p>
          {rate && <RateService serviceId={rate.serviceId} name={chat.other_name} rating={rate.rating} canAct={profile.status === 'verified'} />}
        </section>
        <ol className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.sender_id === profile.id;
            return (
              <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 ${
                    mine ? 'rounded-br-md bg-ink text-on-ink' : 'rounded-bl-md border border-line bg-surface'
                  }`}
                >
                  <span className="sr-only">{mine ? t(lang, 'messages.you') : `${chat.other_name}: `}</span>
                  {m.body}
                </p>
                <span className="mt-0.5 px-1 text-xs text-muted-2">{clockTime(new Date(m.created_at), now, lang)}</span>
              </li>
            );
          })}
        </ol>
      </main>
      <MessageComposer conversationId={chat.id} canSend={profile.status === 'verified'} />
    </>
  );
}
