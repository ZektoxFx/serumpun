import type { MessageKey } from '@/lib/i18n';

// supabase/migrations/0022_chat_topics.sql makes the same six topics and enforces the same rules.

/** A row of `public_topics`: a topic of the caller's township's General chat, its latest message and the caller's unread. */
export type PublicTopic = {
  id: string;
  emoji: string;
  title: string;
  office_only: boolean;
  system_key: 'announcements' | null;
  sort_order: number;
  last_body: string | null;
  last_at: string | null;
  last_sender: string | null;
  unread_count: number;
};
export const PUBLIC_TOPIC_COLUMNS = 'id, emoji, title, office_only, system_key, sort_order, last_body, last_at, last_sender, unread_count';

/** A row of `public_topic_messages`: one message of a topic, who sent it (never a unit) and whether it is the caller's. */
export type TopicMessage = {
  id: string;
  topic_id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  from_office: boolean;
  is_mine: boolean;
};
export const TOPIC_MESSAGE_COLUMNS = 'id, topic_id, body, created_at, sender_name, from_office, is_mine';

/** The topics every General chat starts with. Announcements is the office's, and mirrors its announcements. */
export const STARTING_TOPICS: readonly { emoji: string; title: string; office_only: boolean; system_key: 'announcements' | null; sort_order: number }[] = [
  { emoji: '📢', title: 'Announcements', office_only: true, system_key: 'announcements', sort_order: 0 },
  { emoji: '🆘', title: 'Help & support', office_only: false, system_key: null, sort_order: 10 },
  { emoji: '💬', title: 'Borak-borak', office_only: false, system_key: null, sort_order: 20 },
  { emoji: '👋', title: 'Say hi', office_only: false, system_key: null, sort_order: 30 },
  { emoji: '🔎', title: 'Lost & found', office_only: false, system_key: null, sort_order: 40 },
  { emoji: '🚗', title: 'Traffic & roads', office_only: false, system_key: null, sort_order: 50 },
];

// The `raise exception` codes of the topic RPCs.
const ERROR_KEYS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  not_management: 'map.error.notManagement',
  not_found: 'general.error.notFound',
  office_only: 'general.error.officeOnly',
  bad_body: 'messages.error.body',
  bad_topic: 'general.error.topic',
  system_topic: 'general.error.systemTopic',
};

export function topicErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(ERROR_KEYS, code) ? ERROR_KEYS[code] : 'common.error';
}

/** Unread messages across the topics: the "N new" on the General chat card. */
export function totalUnread(topics: readonly Pick<PublicTopic, 'unread_count'>[]): number {
  return topics.reduce((sum, topic) => sum + topic.unread_count, 0);
}
