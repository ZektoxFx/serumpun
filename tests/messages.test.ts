import { CONTEXT_TYPES, messageErrorKey } from '@/lib/domain/messages';
import { t } from '@/lib/i18n';
import { messageRows } from '@/lib/seed/messages';
import type { People } from '@/lib/seed/people';

it('names every message error and context in both languages', () => {
  for (const code of ['not_verified', 'not_found', 'bad_context', 'self', 'bad_body']) {
    const key = messageErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(messageErrorKey('__proto__')).toBe('common.error');
  expect(messageErrorKey(undefined)).toBe('common.error');
  for (const type of CONTEXT_TYPES) {
    expect(t('en', `messages.context.${type}`)).not.toBe(`messages.context.${type}`);
    expect(t('ms', `messages.context.${type}`)).not.toBe(t('en', `messages.context.${type}`));
  }
});

describe("Aisyah's seeded conversations", () => {
  const now = new Date('2026-10-16T06:00:00Z');
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const stroller = { id: 'stroller-post', body: 'Lending our stroller, barely used.\nHappy to lend it for a few weeks if you have a newborn or visitors with a baby coming 🍼' };
  const { conversations, members, messages } = messageRows(now, people, stroller);
  const mine = members.filter((m) => m.user_id === 'aisyah');

  it('are with Cikgu Farah, Ahmad and Priya, two messages unread', () => {
    const others = mine.map((m) => members.find((o) => o.conversation_id === m.conversation_id && o.user_id !== 'aisyah')!.user_id);
    expect(others.sort()).toEqual(['ahmad', 'farah', 'priya']);
    // As my_conversations counts them: the other person's messages after Aisyah last read the conversation.
    const unread = mine.flatMap((m) =>
      messages.filter((x) => x.conversation_id === m.conversation_id && x.sender_id !== 'aisyah' && x.created_at > (m.last_read_at ?? '')),
    );
    expect(unread).toHaveLength(2);
  });

  it('keep the rules start_conversation and send_message keep', () => {
    for (const c of conversations) {
      const pair = members.filter((m) => m.conversation_id === c.id).map((m) => m.user_id);
      expect(pair).toHaveLength(2);
      expect(c.pair_key).toBe([...pair].sort().join(':'));
      const own = messages.filter((m) => m.conversation_id === c.id);
      expect(c.last_message_at).toBe(own.map((m) => m.created_at).sort().at(-1));
      for (const m of own) expect(pair).toContain(m.sender_id);
    }
    // The stroller chat is about Priya's post, titled from its text on one line, as start_conversation titles it.
    const post = conversations.find((c) => c.context_type === 'post')!;
    expect(post.context_id).toBe('stroller-post');
    expect(post.context_title).toBe('Lending our stroller, barely used. Happy to lend it for a few weeks if you have');
  });

  it('never show a phone number', () => {
    for (const m of messages) expect(m.body).not.toMatch(/\d[\d\s-]{6,}\d/);
  });
});
