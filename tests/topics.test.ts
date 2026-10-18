import { STARTING_TOPICS, topicErrorKey, totalUnread, type PublicTopic } from '@/lib/domain/topics';
import type { People } from '@/lib/seed/people';
import { topicRows } from '@/lib/seed/topics';

describe('General chat topics', () => {
  it('starts with six topics, Announcements first and office only', () => {
    expect(STARTING_TOPICS.map((t) => t.title)).toEqual(['Announcements', 'Help & support', 'Borak-borak', 'Say hi', 'Lost & found', 'Traffic & roads']);
    expect(STARTING_TOPICS[0]).toMatchObject({ office_only: true, system_key: 'announcements' });
    expect(STARTING_TOPICS.slice(1).every((t) => !t.office_only && t.system_key === null)).toBe(true);
  });

  it('maps errors and adds up unread', () => {
    expect(topicErrorKey('office_only')).toBe('general.error.officeOnly');
    expect(topicErrorKey('not_verified')).toBe('common.pendingCantAct');
    expect(topicErrorKey('whatever')).toBe('common.error');
    expect(totalUnread([{ unread_count: 2 }, { unread_count: 3 }] as PublicTopic[])).toBe(5);
  });
});

describe('the seeded topics', () => {
  const now = new Date('2026-10-16T06:00:00Z');
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const notice = { title: 'Water disruption', body: 'Pipe repairs today.', created_by: 'office', created_at: new Date(now.getTime() - 5 * 3_600_000).toISOString() };
  const { topics, messages, reads } = topicRows(now, people, 'general', [notice]);
  const id = (title: string) => topics.find((t) => t.title === title)!.id;
  const inTopic = (title: string) => messages.filter((m) => m.topic_id === id(title));
  const unreadForAisyah = (topicId: string) => {
    const read = reads.find((r) => r.topic_id === topicId && r.user_id === 'aisyah')!.last_read_at;
    return messages.filter((m) => m.topic_id === topicId && m.sender_id !== 'aisyah' && m.created_at > read).length;
  };

  it('are the six starting topics of General chat, each with something said in it', () => {
    expect(topics.map((t) => t.title)).toEqual(STARTING_TOPICS.map((t) => t.title));
    expect(topics.every((t) => t.group_id === 'general')).toBe(true);
    for (const t of topics) expect(inTopic(t.title).length, t.title).toBeGreaterThan(0);
  });

  it('copy each announcement into Announcements, from whoever published it', () => {
    expect(inTopic('Announcements')).toEqual([
      { topic_id: id('Announcements'), sender_id: 'office', body: 'Water disruption\nPipe repairs today.', created_at: notice.created_at },
    ]);
  });

  it("keep General chat's old posts and Kavitha's reply in Borak-borak, 3 unread for Aisyah and none elsewhere", () => {
    expect(inTopic('Borak-borak').map((m) => m.sender_id)).toEqual(['office', 'meiLing', 'hafiz', 'kavitha', 'siti']);
    expect(unreadForAisyah(id('Borak-borak'))).toBe(3);
    for (const t of topics.filter((x) => x.title !== 'Borak-borak')) expect(unreadForAisyah(t.id), t.title).toBe(0);
  });

  it('have nobody post who could not: Nur waits for approval, and only the office posts in Announcements', () => {
    expect(messages.map((m) => m.sender_id)).not.toContain('nur');
    expect(inTopic('Announcements').every((m) => m.sender_id === 'office')).toBe(true);
  });
});
