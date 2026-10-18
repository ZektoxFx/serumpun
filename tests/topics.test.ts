import { STARTING_TOPICS, topicErrorKey, totalUnread, type PublicTopic } from '@/lib/domain/topics';

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
