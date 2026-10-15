import type { MessageKey } from '@/lib/i18n';

// supabase/migrations/0007_groups.sql enforces the same categories, colours and post types.

export const GROUP_CATEGORIES = ['family', 'sports', 'fitness', 'hobbies', 'other'] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];
export const GROUP_ICON: Record<GroupCategory, string> = { family: '🧸', sports: '⚽', fitness: '🏃', hobbies: '🎨', other: '💬' };

/** A group's tile colour. create_group picks one from the category; the seed sets the canvas ones. */
export type GroupColour = 'red' | 'orange' | 'amber' | 'ink' | 'green' | 'purple';

export const POST_TYPES = ['general', 'question', 'share_lend'] as const;
export type PostType = (typeof POST_TYPES)[number];

/** A row of `public_groups`: a group of the township and the caller's membership of it (all null when not a member). */
export type PublicGroup = {
  id: string;
  name: string;
  category: GroupCategory;
  description: string | null;
  rules: string | null;
  colour: GroupColour;
  member_count: number;
  is_member: boolean;
  my_role: 'admin' | 'member' | null;
  joined_at: string | null;
  last_visit_at: string | null;
};
export const PUBLIC_GROUP_COLUMNS = 'id, name, category, description, rules, colour, member_count, is_member, my_role, joined_at, last_visit_at';

/** A row of `public_posts`. The author's name is null only if their account is gone. */
export type PublicPost = {
  id: string;
  group_id: string;
  author_id: string | null;
  author_name: string | null;
  author_neighbourhood: string | null;
  type: PostType;
  body: string;
  comment_count: number;
  created_at: string;
  is_mine: boolean;
};
export const PUBLIC_POST_COLUMNS = 'id, group_id, author_id, author_name, author_neighbourhood, type, body, comment_count, created_at, is_mine';

/** A row of `public_comments`, with whether the caller marked it Helpful. */
export type PublicComment = {
  id: string;
  post_id: string;
  author_name: string | null;
  body: string;
  helpful_count: number;
  created_at: string;
  is_mine: boolean;
  my_helpful: boolean;
};
export const PUBLIC_COMMENT_COLUMNS = 'id, post_id, author_name, body, helpful_count, created_at, is_mine, my_helpful';

/** The Top answer of a question: the comment with the most Helpful votes, the earliest on a tie. None while no vote is cast. */
export function topAnswer(comments: readonly { id: string; helpful_count: number; created_at: string }[]): string | null {
  let top: (typeof comments)[number] | null = null;
  for (const c of comments) {
    if (c.helpful_count <= 0) continue;
    if (!top || c.helpful_count > top.helpful_count || (c.helpful_count === top.helpful_count && Date.parse(c.created_at) < Date.parse(top.created_at))) {
      top = c;
    }
  }
  return top?.id ?? null;
}

/** How many came after the last visit ("5 new"). Before the first visit, all of them. */
export function newSince(items: readonly { created_at: string }[], lastVisit: string | null): number {
  if (lastVisit === null) return items.length;
  const seen = Date.parse(lastVisit);
  return items.filter((item) => Date.parse(item.created_at) > seen).length;
}

// The `raise exception` codes of the group RPCs.
const ERROR_KEYS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  not_found: 'group.error.notFound',
  not_member: 'group.error.notMember',
  bad_name: 'group.error.name',
  bad_category: 'group.error.category',
  bad_type: 'group.error.type',
  bad_body: 'group.error.body',
  admin_cannot_leave: 'group.error.adminLeave',
  own_comment: 'group.error.ownComment',
};

export function groupErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(ERROR_KEYS, code) ? ERROR_KEYS[code] : 'common.error';
}
