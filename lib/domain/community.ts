import type { MessageKey } from '@/lib/i18n';
import { mytDate } from './time';

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
  /** The Share & Lend item a post is about ("Also post to a group"), if any. */
  listing_id: string | null;
  comment_count: number;
  created_at: string;
  is_mine: boolean;
};
export const PUBLIC_POST_COLUMNS =
  'id, group_id, author_id, author_name, author_neighbourhood, type, body, listing_id, comment_count, created_at, is_mine';

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

// supabase/migrations/0009_services.sql enforces the same service kinds, and 0012_service_categories.sql these categories.

export const SERVICE_KINDS = ['offer', 'request'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
// The team's list. Pets keeps its first key, pet_care; Others is everything else (garden, beauty, transport, tech...).
export const SERVICE_CATEGORIES = ['tutoring', 'repairs', 'cleaning', 'food', 'childcare', 'eldercare', 'pet_care', 'other'] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export const SERVICE_ICON: Record<ServiceCategory, string> = {
  tutoring: '📚',
  repairs: '🔧',
  cleaning: '🧹',
  food: '🍲',
  childcare: '👶',
  eldercare: '🧓',
  pet_care: '🐾',
  other: '🤝',
};

/** A row of `public_services`: an offer or a request of the township, by name and neighbourhood (never a unit or phone). */
export type PublicService = {
  id: string;
  kind: ServiceKind;
  category: ServiceCategory;
  title: string;
  description: string | null;
  price_text: string | null;
  availability_text: string | null;
  budget_text: string | null;
  needed_by: string | null;
  created_at: string;
  provider_name: string;
  provider_neighbourhood: string;
  is_mine: boolean;
  /** Conversations started about it: on a request, the neighbours who offered to help. */
  conversation_count: number;
};
export const PUBLIC_SERVICE_COLUMNS =
  'id, kind, category, title, description, price_text, availability_text, budget_text, needed_by, created_at, provider_name, provider_neighbourhood, is_mine, conversation_count';

/** "4.7": the mean of the stars to one decimal, or null with none. supabase/migrations/0014_reviews.sql keeps 1 to 5. */
export function averageRating(ratings: readonly { rating: number }[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10;
}

// supabase/migrations/0010_share.sql enforces the same listing kinds, borrow statuses and moves.

export const LISTING_KINDS = ['lend', 'give', 'swap'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];
/** The pictures a new listing can pick from (no photos yet). */
export const LISTING_EMOJI = ['📦', '🪜', '🛠️', '🔧', '👶', '🧸', '📚', '🏸', '⚽', '🚲', '⛺', '🪴', '🍳', '🎮', '👗', '🧹'] as const;

/** A row of `public_listings`: an item that is up in the township, or one of the caller's own. */
export type PublicListing = {
  id: string;
  kind: ListingKind;
  title: string;
  description: string | null;
  emoji: string;
  swap_for: string | null;
  available_until: string | null;
  status: 'available' | 'given' | 'hidden';
  created_at: string;
  owner_name: string;
  owner_neighbourhood: string;
  is_mine: boolean;
  /** On the caller's own listing, the borrow requests waiting for their answer. */
  waiting_count: number;
};
export const PUBLIC_LISTING_COLUMNS =
  'id, kind, title, description, emoji, swap_for, available_until, status, created_at, owner_name, owner_neighbourhood, is_mine, waiting_count';

/** The four steps of borrowing (spec §8.7); a request can also end declined (by the owner) or cancelled (by the borrower). */
export const BORROW_STEPS = ['requested', 'approved', 'picked_up', 'returned'] as const;
export type BorrowStatus = (typeof BORROW_STEPS)[number] | 'declined' | 'cancelled';

/** A row of `my_borrows`: a borrow request the caller made, or one made for something they lend. */
export type MyBorrow = {
  id: string;
  listing_id: string;
  from_date: string;
  to_date: string;
  status: BorrowStatus;
  updated_at: string;
  listing_title: string;
  listing_emoji: string;
  my_role: 'owner' | 'borrower';
  borrower_name: string;
  borrower_neighbourhood: string;
  owner_name: string;
};
export const MY_BORROW_COLUMNS =
  'id, listing_id, from_date, to_date, status, updated_at, listing_title, listing_emoji, my_role, borrower_name, borrower_neighbourhood, owner_name';

/** Where a request can be moved to: anywhere but back to the start. */
export type BorrowMoveTo = Exclude<BorrowStatus, 'requested'>;

// Who may move a borrow request on, and where to. advance_borrow (0010_share.sql) keeps the same table.
const BORROW_MOVES: Record<'owner' | 'borrower', Partial<Record<BorrowStatus, readonly BorrowMoveTo[]>>> = {
  owner: { requested: ['approved', 'declined'], approved: ['picked_up'], picked_up: ['returned'] },
  borrower: { requested: ['cancelled'], approved: ['cancelled'] },
};

/** Where `actor` may move a request that is at `from`: the buttons they see. */
export function borrowMoves(from: BorrowStatus, actor: 'owner' | 'borrower'): readonly BorrowMoveTo[] {
  return BORROW_MOVES[actor][from] ?? [];
}

export function canAdvanceBorrow(from: BorrowStatus, to: BorrowStatus, actor: 'owner' | 'borrower'): boolean {
  return (borrowMoves(from, actor) as readonly BorrowStatus[]).includes(to);
}

/** The return-day reminders (app/api/cron/reminders): what is picked up and due back today, in Malaysia. */
export function dueToday<T extends { to_date: string; status: BorrowStatus }>(borrows: readonly T[], now: Date): T[] {
  const today = mytDate(now);
  return borrows.filter((b) => b.status === 'picked_up' && b.to_date === today);
}

// The `raise exception` codes of the Share & Lend RPCs.
const SHARE_ERRORS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  not_found: 'share.error.notFound',
  bad_kind: 'share.error.kind',
  bad_title: 'share.error.title',
  bad_dates: 'share.error.dates',
  not_lendable: 'share.error.notLendable',
  own_listing: 'share.error.own',
  already_requested: 'share.error.already',
  not_allowed: 'share.error.notAllowed',
  bad_step: 'share.error.step',
  overlap: 'share.error.overlap',
  on_loan: 'share.error.onLoan',
  not_member: 'share.error.notMember',
};

export function shareErrorKey(code: string | undefined): MessageKey {
  return lookup(SHARE_ERRORS, code);
}

const lookup = (keys: Record<string, MessageKey>, code: string | undefined): MessageKey =>
  code !== undefined && Object.hasOwn(keys, code) ? keys[code] : 'common.error';

// The `raise exception` codes of create_service and rate_service.
const SERVICE_ERRORS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  bad_kind: 'service.error.kind',
  bad_category: 'service.error.category',
  bad_title: 'service.error.title',
  bad_date: 'service.error.date',
  not_found: 'service.error.notFound',
  self: 'service.error.self',
  bad_rating: 'service.error.rating',
  no_conversation: 'service.error.noConversation',
};

export function serviceErrorKey(code: string | undefined): MessageKey {
  return lookup(SERVICE_ERRORS, code);
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
  return lookup(ERROR_KEYS, code);
}
