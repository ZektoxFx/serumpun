import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContextType } from '@/lib/domain/messages';
import type { People, PersonKey } from './people';

const HOUR = 3_600_000;

type SeedChat = {
  with: PersonKey;
  /** What it is about; 'stroller' is Priya's Share & Lend post in Elmina Mommies (lib/seed/community.ts). */
  context: { type: ContextType; title: string } | 'stroller';
  /** Hours since Aisyah last read it: the other person's messages after that are unread. */
  readHoursAgo: number;
  messages: [from: 'aisyah' | 'them', hoursAgo: number, body: string][];
};

// Plan Task 13: Aisyah's chats about Cikgu Farah's tuition, Ahmad's ladder and Priya's stroller, 2 messages unread. The
// tuition and the ladder have no service or listing row yet (Tasks 14 and 15 seed them), so no context id either.
const CHATS: SeedChat[] = [
  {
    with: 'farah',
    context: { type: 'service', title: 'Maths tuition for Year 4 to 6' },
    readHoursAgo: 24,
    messages: [
      ['aisyah', 49, 'Hi Cikgu Farah, do you still have a Saturday morning slot for my nephew? He is in Year 5.'],
      ['them', 48, 'Yes, 10 to 11 am is free. RM40 an hour, at my house or online.'],
      ['aisyah', 25, 'At your house, please. Should he bring anything?'],
      ['them', 0.5, 'Just his school textbook and a pencil case. See you on Saturday!'],
    ],
  },
  {
    with: 'ahmad',
    context: { type: 'listing', title: 'Ladder (6 ft), to borrow' },
    readHoursAgo: 48,
    messages: [
      ['them', 72, 'Hi Aisyah, the ladder is free this weekend if you still need it.'],
      ['aisyah', 71.5, 'Yes please! Can I pick it up on Saturday morning?'],
      ['them', 70, 'Sure, any time after 9. I will leave it by the gate.'],
      ['aisyah', 48, 'Thank you! I will bring it back on Sunday evening.'],
    ],
  },
  {
    with: 'priya',
    context: 'stroller',
    readHoursAgo: 5,
    messages: [
      ['aisyah', 5, 'Hi Priya, my sister is visiting with her baby next week. Could we borrow the stroller?'],
      ['them', 1, 'Of course! Pick it up any evening this week, I am home after 6.'],
    ],
  },
];

/** A post's text on one line, cut to 80 characters: how start_conversation titles a conversation about it. */
const titleOf = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 80).trim();

/** Aisyah's conversations, relative to `now`, as start_conversation and send_message would have left them. */
export function messageRows(now: Date, people: People, stroller: { id: string; body: string }) {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR).toISOString();
  const me = people.ids.aisyah;
  const conversations = [];
  const members = [];
  const messages = [];
  for (const chat of CHATS) {
    const id = crypto.randomUUID();
    const other = people.ids[chat.with];
    const context =
      chat.context === 'stroller'
        ? { type: 'post' as const, id: stroller.id, title: titleOf(stroller.body) }
        : { ...chat.context, id: null };
    const last = at(Math.min(...chat.messages.map(([, hoursAgo]) => hoursAgo)));
    conversations.push({
      id,
      context_type: context.type,
      context_id: context.id,
      context_title: context.title,
      pair_key: [me, other].sort().join(':'),
      created_at: at(chat.messages[0][1]),
      last_message_at: last,
    });
    members.push({ conversation_id: id, user_id: me, last_read_at: at(chat.readHoursAgo) });
    members.push({ conversation_id: id, user_id: other, last_read_at: last }); // the neighbours have read it all
    for (const [from, hoursAgo, body] of chat.messages) {
      messages.push({ conversation_id: id, sender_id: from === 'aisyah' ? me : other, body, created_at: at(hoursAgo) });
    }
  }
  return { conversations, members, messages };
}

/** Aisyah's three conversations. Runs after seedCommunity: Priya's is about her stroller post. */
export async function seedMessages(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { data: stroller, error } = await admin
    .from('posts')
    .select('id, body')
    .eq('author_id', people.ids.priya)
    .ilike('body', 'Lending our stroller%')
    .single();
  if (error) throw new Error(`stroller post: ${error.message}`);
  const { conversations, members, messages } = messageRows(now, people, stroller);
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
