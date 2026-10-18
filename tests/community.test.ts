import {
  GROUP_CATEGORIES,
  POST_TYPES,
  SERVICE_CATEGORIES,
  averageRating,
  dueToday,
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
  const codes = [
    'not_verified', 'not_found', 'not_member', 'bad_name', 'bad_category', 'bad_type', 'bad_body', 'admin_cannot_leave', 'own_comment',
    'general_group',
  ];
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

  it('are the five of the spec and General chat, with Aisyah in three of the five', () => {
    expect(groups.map((g) => g.name).sort()).toEqual([
      'Central Park Briskwalkers',
      'Elmina Mommies',
      'Elmina Morning Runners',
      'Elmina Toddler Playdates',
      'General chat',
      'Sunday Futsal Dads',
    ]);
    const hers = members
      .filter((m) => m.user_id === 'aisyah')
      .map((m) => groups.find((g) => g.id === m.group_id)!)
      .filter((g) => !g.is_general)
      .map((g) => g.name);
    expect(hers.sort()).toEqual(['Central Park Briskwalkers', 'Elmina Mommies', 'Elmina Morning Runners']);
  });

  it('put every verified person in General chat, the office as its admin, with no posts (its talk is in topics)', () => {
    expect(groups.filter((g) => g.is_general)).toHaveLength(1);
    const general = groups.find((g) => g.is_general)!;
    const inIt = members.filter((m) => m.group_id === general.id);
    expect(inIt).toHaveLength(15); // the 16 seeded people but Nur, who waits for approval
    expect(inIt.map((m) => m.user_id)).not.toContain('nur');
    expect(inIt.filter((m) => m.role === 'admin').map((m) => m.user_id)).toEqual(['office']);
    expect(posts.filter((p) => p.group_id === general.id)).toEqual([]);
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

describe('dueToday', () => {
  const borrows = [
    { id: 'out-today', to_date: '2026-10-18', status: 'picked_up' },
    { id: 'out-yesterday', to_date: '2026-10-17', status: 'picked_up' },
    { id: 'not-picked-up', to_date: '2026-10-18', status: 'approved' },
    { id: 'back-already', to_date: '2026-10-18', status: 'returned' },
  ] as const;
  it('takes what is still out and due back today in Malaysia', () => {
    // 16:30 UTC on the 17th is half past midnight on the 18th in Malaysia.
    expect(dueToday(borrows, new Date('2026-10-17T16:30:00Z')).map((b) => b.id)).toEqual(['out-today']);
    expect(dueToday(borrows, new Date('2026-10-17T15:59:59Z')).map((b) => b.id)).toEqual(['out-yesterday']);
  });
});

describe('averageRating', () => {
  it('is null with no ratings', () => {
    expect(averageRating([])).toBeNull();
  });
  it('is the mean to one decimal', () => {
    expect(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 5 }])).toBe(4.7);
    expect(averageRating([{ rating: 4 }, { rating: 5 }])).toBe(4.5);
    expect(averageRating([{ rating: 5 }])).toBe(5);
  });
});

it('names every service error and category in both languages', () => {
  for (const code of ['not_verified', 'bad_kind', 'bad_category', 'bad_title', 'bad_date', 'not_found', 'self', 'bad_rating', 'no_conversation']) {
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
  const { services, reviews, posts, listings } = communityRows(now, people);
  const newest = (kind: string) => services.filter((s) => s.kind === kind).sort((a, b) => b.created_at.localeCompare(a.created_at));

  it('open with the three cards of the approved canvas, among 13', () => {
    expect(services).toHaveLength(13);
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

  it('fill every category chip', () => {
    expect(new Set(services.map((s) => s.category))).toEqual(new Set(SERVICE_CATEGORIES));
  });

  it("link Priya's stroller post to her stroller, so the group shows the item (ruling R6)", () => {
    const linked = posts.filter((p) => p.listing_id !== null);
    expect(linked.map((p) => [p.author_id, p.type])).toEqual([['priya', 'share_lend']]);
    expect(listings.find((l) => l.id === linked[0].listing_id)).toMatchObject({ title: 'Baby stroller', owner_id: 'priya' });
  });

  it("rate Cikgu Farah 4.9 and Ravi 4.7 as the canvas does, one rating per neighbour, never the provider's own", () => {
    const average = (title: string) => {
      const id = services.find((s) => s.title === title)!.id;
      return averageRating(reviews.filter((r) => r.service_id === id));
    };
    expect(average('Maths & Science tuition, Form 1–3')).toBe(4.9);
    expect(average('Aircon servicing & small repairs')).toBe(4.7);
    expect(new Set(reviews.map((r) => `${r.service_id} ${r.reviewer_id}`)).size).toBe(reviews.length);
    for (const r of reviews) {
      const service = services.find((s) => s.id === r.service_id)!;
      expect(service.kind).toBe('offer');
      expect(r.reviewer_id).not.toBe(service.provider_id);
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
    }
    // The demo accounts have rated nothing yet: Aisyah rates Cikgu Farah in the demo.
    expect(reviews.some((r) => ['aisyah', 'daniel', 'nur', 'office'].includes(r.reviewer_id))).toBe(false);
  });
});
