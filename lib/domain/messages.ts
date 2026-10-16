import type { MessageKey } from '@/lib/i18n';

// supabase/migrations/0008_messages.sql enforces the same context types and message length.

/** What a conversation is about: a Share & Lend group post, a service, a Share & Lend item or an open game. */
export const CONTEXT_TYPES = ['post', 'service', 'listing', 'game'] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];
export const CONTEXT_ICON: Record<ContextType, string> = { post: '💬', service: '🤝', listing: '🔁', game: '🏸' };

/** A row of `my_conversations`: one of the caller's conversations, the other person in it and its latest message. */
export type Conversation = {
  id: string;
  context_type: ContextType;
  context_title: string;
  last_message_at: string;
  other_name: string;
  other_neighbourhood: string;
  last_body: string | null;
  last_is_mine: boolean;
  unread_count: number;
};
export const CONVERSATION_COLUMNS =
  'id, context_type, context_title, last_message_at, other_name, other_neighbourhood, last_body, last_is_mine, unread_count';

// The `raise exception` codes of the message RPCs.
const ERROR_KEYS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  not_found: 'messages.error.notFound',
  bad_context: 'messages.error.context',
  self: 'messages.error.self',
  bad_body: 'messages.error.body',
};

export function messageErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(ERROR_KEYS, code) ? ERROR_KEYS[code] : 'common.error';
}
