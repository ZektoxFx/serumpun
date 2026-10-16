import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContextType } from '@/lib/domain/messages';
import type { People, PersonKey } from './people';

const HOUR = 3_600_000;

/** The rows lib/seed/community.ts made that the conversations are about. */
type Contexts = {
  /** Priya's Share & Lend post in Elmina Mommies. */
  stroller: { id: string; body: string };
  /** Cikgu Farah's tuition offer. */
  tuition: { id: string; title: string };
  /** Tan Wei Ming's request for someone to fix his sink. */
  sink: { id: string; title: string };
  /** Ahmad's ladder, which Aisyah is borrowing. */
  ladder: { id: string; title: string };
};
const CONTEXT_TYPE: Record<keyof Contexts, ContextType> = { stroller: 'post', tuition: 'service', sink: 'service', ladder: 'listing' };

type SeedChat = {
  /** Two people. The first last read it `readHoursAgo` hours ago (null: not since it started); the second, at its end. */
  between: [PersonKey, PersonKey];
  context: keyof Contexts;
  readHoursAgo: number | null;
  messages: [from: 0 | 1, hoursAgo: number, body: string][];
};

// Plan Task 13: Aisyah's chats about Cikgu Farah's tuition, Ahmad's ladder and Priya's stroller, 2 messages unread.
// Task 14: the two neighbours who offered to fix Tan Wei Ming's sink, the canvas card's "2 offered to help".
const CHATS: SeedChat[] = [
  {
    between: ['aisyah', 'farah'],
    context: 'tuition',
    readHoursAgo: 24,
    messages: [
      [0, 49, 'Hi Cikgu Farah, do you still have a Saturday morning slot for my nephew? He is in Form 2.'],
      [1, 48, 'Yes, 10 to 11 am is free. RM40 an hour, at my house or online.'],
      [0, 25, 'At your house, please. Should he bring anything?'],
      [1, 0.5, 'Just his school textbook and a pencil case. See you on Saturday!'],
    ],
  },
  {
    between: ['aisyah', 'ahmad'],
    context: 'ladder',
    readHoursAgo: 48,
    messages: [
      [1, 72, 'Hi Aisyah, the ladder is free this weekend if you still need it.'],
      [0, 71.5, 'Yes please! Can I pick it up on Saturday morning?'],
      [1, 70, 'Sure, any time after 9. I will leave it by the gate.'],
      [0, 48, 'Thank you! I will bring it back on Sunday evening.'],
    ],
  },
  {
    between: ['aisyah', 'priya'],
    context: 'stroller',
    readHoursAgo: 5,
    messages: [
      [0, 5, 'Hi Priya, my sister is visiting with her baby next week. Could we borrow the stroller?'],
      [1, 1, 'Of course! Pick it up any evening this week, I am home after 6.'],
    ],
  },
  {
    between: ['weiMing', 'hafiz'],
    context: 'sink',
    readHoursAgo: null,
    messages: [[1, 20, 'Hi! I can fix it tomorrow evening. Is it the kitchen sink?']],
  },
  {
    between: ['weiMing', 'ravi'],
    context: 'sink',
    readHoursAgo: null,
    messages: [[1, 9, 'I have spare parts for most taps. I can come on Saturday morning.']],
  },
];

/** A post's text on one line, cut to 80 characters: how start_conversation titles a conversation about it. */
const titleOf = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 80).trim();

/** The seeded conversations, relative to `now`, as start_conversation and send_message would have left them. */
export function messageRows(now: Date, people: People, contexts: Contexts) {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR).toISOString();
  const conversations = [];
  const members = [];
  const messages = [];
  for (const chat of CHATS) {
    const id = crypto.randomUUID();
    const [a, b] = chat.between.map((key) => people.ids[key]);
    // As start_conversation titles them: a post by its text, a service by its title.
    const context =
      chat.context === 'stroller'
        ? { type: CONTEXT_TYPE.stroller, id: contexts.stroller.id, title: titleOf(contexts.stroller.body) }
        : { type: CONTEXT_TYPE[chat.context], ...contexts[chat.context] };
    const last = at(Math.min(...chat.messages.map(([, hoursAgo]) => hoursAgo)));
    conversations.push({
      id,
      context_type: context.type,
      context_id: context.id,
      context_title: context.title,
      pair_key: [a, b].sort().join(':'),
      created_at: at(chat.messages[0][1]),
      last_message_at: last,
    });
    members.push({ conversation_id: id, user_id: a, last_read_at: chat.readHoursAgo === null ? null : at(chat.readHoursAgo) });
    members.push({ conversation_id: id, user_id: b, last_read_at: last });
    for (const [from, hoursAgo, body] of chat.messages) {
      messages.push({ conversation_id: id, sender_id: from === 0 ? a : b, body, created_at: at(hoursAgo) });
    }
  }
  return { conversations, members, messages };
}

/** The seeded conversations. Runs after seedCommunity, which makes the post and services they are about. */
export async function seedMessages(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const [stroller, services, ladder] = await Promise.all([
    admin.from('posts').select('id, body').eq('author_id', people.ids.priya).ilike('body', 'Lending our stroller%').single(),
    admin.from('services').select('id, title, provider_id'),
    admin.from('listings').select('id, title').eq('owner_id', people.ids.ahmad).ilike('title', 'Aluminium ladder%').single(),
  ]);
  if (stroller.error) throw new Error(`stroller post: ${stroller.error.message}`);
  if (services.error) throw new Error(`services: ${services.error.message}`);
  if (ladder.error) throw new Error(`ladder listing: ${ladder.error.message}`);
  const service = (by: PersonKey, title: string) => {
    const found = services.data.find((s) => s.provider_id === people.ids[by] && s.title.startsWith(title));
    if (!found) throw new Error(`service "${title}" is not seeded`);
    return { id: found.id as string, title: found.title as string };
  };
  const { conversations, members, messages } = messageRows(now, people, {
    stroller: stroller.data,
    tuition: service('farah', 'Maths & Science tuition'),
    sink: service('weiMing', 'Need someone to fix a leaking sink'),
    ladder: ladder.data,
  });
  const tables: [string, Record<string, unknown>[]][] = [
    ['conversations', conversations],
    ['conversation_members', members],
    ['messages', messages],
  ];
  for (const [table, rows] of tables) {
    const { error: insertError } = await admin.from(table).insert(rows);
    if (insertError) throw new Error(`${table}: ${insertError.message}`);
  }
  console.log(`messages: ${conversations.length} conversations with ${messages.length} messages`);
}
