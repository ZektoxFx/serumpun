import type { SupabaseClient } from '@supabase/supabase-js';
// From core, not the index: the index brings React context, and this file is library code.
import type { MessageKey } from '@/lib/i18n/core';

export type MemberRole = 'owner' | 'co_owner' | 'adult' | 'child';
/** A person on a card. `icChecked` is whether the office has checked their IC, which only a Co-owner's rights depend on (spec section 5). */
export type Member = { userId: string; role: MemberRole; icChecked: boolean };

export const INVITE_ROLES = ['child', 'adult', 'co_owner'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
/** What may be done with a role: `true`, or the refusal `create_invite` would give. */
export type InviteChoice = true | 'not_allowed' | 'needs_both' | 'has_co_owner';

/** The managers of a card: its Owner, and its Co-owner once the office has checked their IC (`card_managers` in 0025). */
export function isManager(m: Pick<Member, 'role' | 'icChecked'>): boolean {
  return m.role === 'owner' || (m.role === 'co_owner' && m.icChecked);
}

/**
 * What `me` may invite to a card, for the invite sheet. It mirrors `create_invite` (0025), which stays the authority and
 * asks again. A child: any manager. An adult: the Owner, while no checked Co-owner has to agree too (stage 3 adds the
 * two-person approvals). A Co-owner: the Owner, while the card has none and no invite for one is open.
 */
export function inviteChoices(
  me: Member,
  card: { members: Member[]; openInviteRoles: InviteRole[] },
): Record<InviteRole, InviteChoice> {
  if (!isManager(me)) return { child: 'not_allowed', adult: 'not_allowed', co_owner: 'not_allowed' };
  const owner = me.role === 'owner';
  const checkedCoOwner = card.members.some((m) => m.role === 'co_owner' && m.icChecked);
  const hasCoOwner = card.members.some((m) => m.role === 'co_owner') || card.openInviteRoles.includes('co_owner');
  return {
    child: true,
    adult: owner && !checkedCoOwner ? true : 'needs_both',
    co_owner: !owner ? 'not_allowed' : hasCoOwner ? 'has_co_owner' : true,
  };
}

// The `raise exception` codes of create_invite and cancel_invite that a resident can act on.
const HOUSEHOLD_ERRORS: Record<string, MessageKey> = {
  no_card: 'card.error.no_card',
  card_full: 'card.error.card_full',
  has_co_owner: 'invite.why.has_co_owner',
  needs_both: 'invite.why.needs_both',
  not_allowed: 'household.error.not_allowed',
  bad_role: 'household.error.bad_role',
  bad_name: 'household.error.bad_name',
  name_taken: 'household.error.name_taken',
  not_found: 'household.error.not_found',
};

/** What to tell a resident whose invite was refused. Anything unexpected is the generic error. A disabled role's reason is told the same way. */
export function householdErrorKey(code: string | undefined): MessageKey {
  return code !== undefined && Object.hasOwn(HOUSEHOLD_ERRORS, code) ? HOUSEHOLD_ERRORS[code] : 'common.error';
}

/** A person on the card, with the name the household sees. */
export type Person = Member & { name: string };
/** An invite nobody has used or cancelled, and that has not run out. */
export type OpenInvite = { id: string; name: string; role: InviteRole; createdBy: string | null; expiresAt: string };
export type Household = {
  people: Person[];
  invites: OpenInvite[];
  me: Person;
  choices: Record<InviteRole, InviteChoice>;
};

type MemberRow = { user_id: string; role: MemberRole; ic_checked_at: string | null; profile: { full_name: string } };
type InviteRow = { id: string; name: string; role: InviteRole; created_by: string | null; expires_at: string };

const RANK: Record<MemberRole, number> = { owner: 0, co_owner: 1, adult: 2, child: 3 };

/**
 * Who is on card `cardId` (Owner first, children last), its open invites, and what `userId` may invite. Row-level security
 * shows a member only their own card's people, their names and invites, so `supabase` must act as that person.
 */
export async function loadHousehold(supabase: SupabaseClient, cardId: string, userId: string, now: Date): Promise<Household> {
  const [members, invites] = await Promise.all([
    supabase
      .from('card_members')
      .select('user_id, role, ic_checked_at, profile:profiles(full_name)')
      .eq('card_id', cardId)
      .order('created_at')
      // PostgREST sends a to-one embed as an object; without generated schema types the client guesses an array.
      .overrideTypes<MemberRow[], { merge: false }>(),
    supabase
      .from('card_codes')
      .select('id, name, role, created_by, expires_at')
      .eq('card_id', cardId)
      .eq('kind', 'invite')
      .is('used_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', now.toISOString())
      .order('created_at')
      .overrideTypes<InviteRow[], { merge: false }>(),
  ]);
  if (members.error) throw new Error(`card members lookup failed: ${members.error.message}`);
  if (invites.error) throw new Error(`card invites lookup failed: ${invites.error.message}`);

  const people = members.data
    .map((m) => ({ userId: m.user_id, name: m.profile.full_name, role: m.role, icChecked: m.ic_checked_at !== null }))
    .sort((a, b) => RANK[a.role] - RANK[b.role]); // stable: people of one role stay in the order they joined
  const me = people.find((p) => p.userId === userId);
  if (!me) throw new Error('household lookup failed: you are not on this card');
  const open = invites.data.map((i) => ({ id: i.id, name: i.name, role: i.role, createdBy: i.created_by, expiresAt: i.expires_at }));
  return { people, invites: open, me, choices: inviteChoices(me, { members: people, openInviteRoles: open.map((i) => i.role) }) };
}
