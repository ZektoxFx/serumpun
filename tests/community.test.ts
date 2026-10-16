import {
  GROUP_CATEGORIES,
  POST_TYPES,
  SERVICE_CATEGORIES,
  groupErrorKey,
  newSince,
  serviceErrorKey,
  topAnswer,
} from '@/lib/domain/community';
import { mytDate } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { communityRows } from '@/lib/seed/community';
import type { People } from '@/lib/seed/people';

const comment = (id: string, helpful_count: number, created_at: string) => ({ id, helpful_count, created_at });

describe('topAnswer', () => {
  it('is null while no comment has a Helpful vote', () => {
    expect(topAnswer([])).toBeNull();
    expect(topAnswer([comment('a', 0, '2026-10-16T01:00:00Z')])).toBeNull();
  });
  it('is the comment with the most Helpful votes', () => {
    const comments = [comment('a', 2, '2026-10-16T01:00:00Z'), comment('b', 9, '2026-10-16T02:00:00Z'), comment('c', 0, '2026-10-16T03:00:00Z')];
    expect(topAnswer(comments)).toBe('b');
  });
  it('takes the earliest on a tie', () => {
    expect(topAnswer([comment('late', 3, '2026-10-16T05:00:00Z'), comment('early', 3, '2026-10-16T04:00:00+00:00')])).toBe('early');
  });
});

describe('newSince', () => {
  const posts = ['2026-10-16T01:00:00Z', '2026-10-16T03:00:00Z', '2026-10-16T05:00:00Z'].map((created_at) => ({ created_at }));
  it('counts what came after the last visit', () => {
    expect(newSince(posts, '2026-10-16T03:00:00Z')).toBe(1); // a post at the very moment of the visit was seen
    expect(newSince(posts, '2026-10-16T00:00:00Z')).toBe(3);
    expect(newSince(posts, '2026-10-16T06:00:00Z')).toBe(0);
  });
  it('counts everything before the first visit', () => {
    expect(newSince(posts, null)).toBe(3);
  });
});

it('names every group error, category and post type in both languages', () => {
  const codes = ['not_verified', 'not_found', 'not_member', 'bad_name', 'bad_category', 'bad_type', 'bad_body', 'admin_cannot_leave', 'own_comment'];
  for (const code of codes) {
    const key = groupErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(groupErrorKey('__proto__')).toBe('common.error');
  expect(groupErrorKey(undefined)).toBe('common.error');
  for (const key of [...GROUP_CATEGORIES.map((c) => `group.category.${c}` as const), ...POST_TYPES.map((p) => `group.type.${p}` as const)]) {
    expect(t('en', key)).not.toBe(key);
    expect(t('ms', key)).not.toBe(t('en', key));
  }
});

describe('the seeded groups', () => {
  const now = new Date('2026-10-16T06:00:00Z'); // 2 pm in Malaysia
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const { groups, members, posts, comments, helpful } = communityRows(now, people);
  const group = (name: string) => groups.find((g) => g.name === name)!;
  const isMember = (groupId: string, user: string) => members.some((m) => m.group_id === groupId && m.user_id === user);

  it('are the five of the spec, with Aisyah in three of them', () => {
    expect(groups.map((g) => g.name).sort()).toEqual([
      'Central Park Briskwalkers',
      'Elmina Mommies',
      'Elmina Morning Runners',
      'Elmina Toddler Playdates',
      'Sunday Futsal Dads',
    ]);
    const hers = members.filter((m) => m.user_id === 'aisyah').map((m) => groups.find((g) => g.id === m.group_id)!.name);
    expect(hers.sort()).toEqual(['Central Park Briskwalkers', 'Elmina Mommies', 'Elmina Morning Runners']);
  });

  it('show Aisyah 5 new posts in Elmina Mommies, which she joined today', () => {
    const mommies = group('Elmina Mommies');
    const hers = members.find((m) => m.group_id === mommies.id && m.user_id === 'aisyah')!;
    expect(mytDate(new Date(hers.joined_at))).toBe(mytDate(now));
    const others = posts.filter((p) => p.group_id === mommies.id && p.author_id !== 'aisyah');
    expect(newSince(others, hers.last_visit_at)).toBe(5);
  });

  it("put Mei Ling's answer on top of Aisyah's question, with 9 Helpful", () => {
    const question = posts.find((p) => p.author_id === 'aisyah' && p.type === 'question')!;
    expect(question.body).toMatch(/paediatrician/);
    const answers = comments.filter((c) => c.post_id === question.id);
    const top = answers.find((c) => c.id === topAnswer(answers))!;
    expect([top.author_id, top.helpful_count]).toEqual(['meiLing', 9]);
    // Aisyah has not marked it yet, so the demo can.
    expect(helpful.some((h) => h.comment_id === top.id && h.user_id === 'aisyah')).toBe(false);
  });

  it('keep the rules the RPCs enforce', () => {
    for (const p of posts) {
      expect(isMember(p.group_id, p.author_id), p.body).toBe(true); // only members post
      expect(p.comment_count).toBe(comments.filter((c) => c.post_id === p.id).length);
    }
    for (const c of comments) expect(isMember(posts.find((p) => p.id === c.post_id)!.group_id, c.author_id), c.body).toBe(true);
    for (const h of helpful) {
      const c = comments.find((x) => x.id === h.comment_id)!;
      expect(h.user_id).not.toBe(c.author_id); // nobody marks their own comment
      expect(isMember(posts.find((p) => p.id === c.post_id)!.group_id, h.user_id)).toBe(true);
    }
    // Shown counts never fall below the rows behind them (the seed shows more than its 16 people can make).
    for (const c of comments) expect(c.helpful_count).toBeGreaterThanOrEqual(helpful.filter((h) => h.comment_id === c.id).length);
    for (const g of groups) {
      const rows = members.filter((m) => m.group_id === g.id);
      expect(g.member_count).toBeGreaterThanOrEqual(rows.length);
      expect(rows.filter((m) => m.role === 'admin')).toHaveLength(1);
    }
    expect(new Set(members.map((m) => `${m.group_id}:${m.user_id}`)).size).toBe(members.length);
  });

  it('link the Fun Run to the Morning Runners and the toddler playdate to the Mommies (ruling R6)', () => {
    expect(communityRows(now, people).eventGroups).toMatchObject({
      'Elmina Fun Run 5K': 'Elmina Morning Runners',
      'Toddler playdate': 'Elmina Mommies',
    });
  });
});

it('names every service error and category in both languages', () => {
  for (const code of ['not_verified', 'bad_kind', 'bad_category', 'bad_title', 'bad_date']) {
    const key = serviceErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(serviceErrorKey('__proto__')).toBe('common.error');
  for (const category of SERVICE_CATEGORIES) {
    expect(t('en', `service.category.${category}`)).not.toBe(`service.category.${category}`);
    expect(t('ms', `service.category.${category}`)).not.toBe(t('en', `service.category.${category}`));
  }
});

describe('the seeded services', () => {
  const now = new Date('2026-10-16T06:00:00Z');
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const { services } = communityRows(now, people);
  const newest = (kind: string) => services.filter((s) => s.kind === kind).sort((a, b) => b.created_at.localeCompare(a.created_at));

  it('open with the three cards of the approved canvas, among 10', () => {
    expect(services).toHaveLength(10);
    expect(newest('offer').slice(0, 2).map((s) => [s.title, s.provider_id, s.price_text])).toEqual([
      ['Maths & Science tuition, Form 1–3', 'farah', 'RM40 / hour'],
      ['Aircon servicing & small repairs', 'ravi', 'From RM80'],
    ]);
    const [sink] = newest('request');
    expect([sink.title, sink.provider_id, sink.budget_text]).toEqual(['Need someone to fix a leaking sink this week', 'weiMing', 'RM50–80']);
  });

  it('keep the rules create_service keeps', () => {
    for (const s of services) {
      if (s.kind === 'offer') expect([s.budget_text, s.needed_by], s.title).toEqual([null, null]);
      else expect([s.price_text, s.availability_text], s.title).toEqual([null, null]);
      expect(SERVICE_CATEGORIES).toContain(s.category);
      if (s.needed_by) expect(s.needed_by >= mytDate(now), s.title).toBe(true);
    }
  });
});
