import type { SupabaseClient } from '@supabase/supabase-js';
import { STARTING_TOPICS } from '@/lib/domain/topics';
import type { People, PersonKey } from './people';

const HOUR = 3_600_000;

// What people said in each topic, oldest first: who, hours ago, what. Borak-borak holds General chat's posts from before
// topics, with Kavitha's reply. Announcements is filled from the seeded announcements instead.
const MESSAGES: Record<string, [PersonKey, number, string][]> = {
  'Help & support': [
    ['daniel', 5, 'How do I book the BBQ pit at Central Park for Saturday evening?'],
    ['office', 4.5, 'Hi Daniel! Book it in the app under Facilities › BBQ pit. Slots are 3 hours; please leave it clean for the next family 🙏'],
    ['meiLing', 4, 'Tip: book early, Saturday evenings go fast. The pit nearest the lake has the most shade.'],
  ],
  'Borak-borak': [
    ['office', 30, 'Welcome to General chat! Everyone in Elmina is here. Be kind, and use Report an issue for anything that needs fixing.'],
    ['meiLing', 2.5, "Thank you to whoever handed my son's bicycle to the guardhouse yesterday! 🙏"],
    ['hafiz', 1, 'Has anyone seen an orange cat with a blue collar near Elmina Valley 2? Our Oyen went missing this morning.'],
    ['kavitha', 0.5, 'Saw one near the playground on Jalan Elmina Valley 2/3 about 20 minutes ago!'],
    ['siti', 0.02, 'Hai semua! Is the Sunday pasar pagi at Central Park on this week?'],
  ],
  'Say hi': [
    ['arif', 26, 'Hi all, Arif here! Moved into Elmina Valley 3 last month. Any good mamak nearby? 😄'],
    ['priya', 25, 'Welcome, Arif! Try the one beside the Elmina Lakeside Mall, the roti canai is excellent.'],
    ['ahmad', 24, 'Selamat datang, jiran! Join us for futsal on Sundays 👋'],
  ],
  'Lost & found': [['ahmad', 20, 'Found a blue water bottle with stickers at the futsal court last night. It is at the Elmina Valley 3 guardhouse.']],
  'Traffic & roads': [['priya', 3, 'Heads up: a lorry broke down on Persiaran Elmina near the toll. Use the Elmina Green exit for now.']],
};

/** Aisyah last read Borak-borak 2 hours ago (the 3 messages since are new to her) and every other topic just now. */
const AISYAH_READ_BORAK_HOURS = 2;

type Announcement = { title: string; body: string; created_by: string | null; created_at: string };

/** The topics' rows, relative to `now`, in the General chat `groupId`, with a message for each of `announcements`. */
export function topicRows(now: Date, people: People, groupId: string, announcements: Announcement[]) {
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();
  const topics = STARTING_TOPICS.map((s) => ({ id: crypto.randomUUID(), group_id: groupId, ...s }));
  const id = (title: string) => topics.find((t) => t.title === title)!.id;
  const messages = [
    // As the database mirrors them (0022_chat_topics.sql): the title, then the text, from whoever published it.
    ...announcements.map((a) => ({ topic_id: id('Announcements'), sender_id: a.created_by, body: `${a.title}\n${a.body}`, created_at: a.created_at })),
    ...Object.entries(MESSAGES).flatMap(([title, lines]) =>
      lines.map(([by, hours, body]) => ({ topic_id: id(title), sender_id: people.ids[by] as string | null, body, created_at: ago(hours) })),
    ),
  ];
  const reads = topics.map((t) => ({
    topic_id: t.id,
    user_id: people.ids.aisyah,
    last_read_at: t.title === 'Borak-borak' ? ago(AISYAH_READ_BORAK_HOURS) : now.toISOString(),
  }));
  return { topics, messages, reads };
}

/**
 * General chat's six topics with what people said in them. After seedCommunity (General chat) and seedAlerts (the
 * announcement, published before any Announcements topic existed, so the database mirrored nothing: it is copied here).
 */
export async function seedTopics(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { data: group, error } = await admin.from('groups').select('id').eq('township_id', people.townshipId).eq('is_general', true).single();
  if (error) throw new Error(`General chat: ${error.message}`);
  const { data: announcements, error: noticeError } = await admin
    .from('announcements')
    .select('title, body, created_by, created_at')
    .eq('township_id', people.townshipId);
  if (noticeError) throw new Error(`announcements: ${noticeError.message}`);
  const { topics, messages, reads } = topicRows(now, people, group.id, announcements);
  const tables: [string, Record<string, unknown>[]][] = [
    ['chat_topics', topics],
    ['topic_messages', messages],
    ['topic_reads', reads],
  ];
  for (const [table, rows] of tables) {
    const { error: insertError } = await admin.from(table).insert(rows);
    if (insertError) throw new Error(`${table}: ${insertError.message}`);
  }
  console.log(`General chat: ${topics.length} topics with ${messages.length} messages`);
}
