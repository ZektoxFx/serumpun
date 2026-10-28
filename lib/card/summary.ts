import type { SupabaseClient } from '@supabase/supabase-js';
import type { Place } from './crypto';

/** What Me and the reader's phone show of a household card. No names: the card is the household's, not a person's. */
export type CardSummary = {
  id: string;
  unit: string;
  places: Place[];
  suspended: boolean;
  reason: string | null;
  leaseEnd: string | null;
  phones: number;
  phoneLimit: number;
  role: 'owner' | 'co_owner' | 'adult' | 'child';
  /** A new browser has asked for the caller's own phone's card and waits: the old phone is asked, and a manager can approve. */
  moveWaiting: boolean;
};

type MemberRow = {
  role: CardSummary['role'];
  card: {
    id: string;
    status: 'active' | 'suspended';
    suspended_reason: string | null;
    places: Place[];
    phone_limit: number;
    unit: { label: string; lease_end: string | null };
  };
};

/**
 * The card `userId` is on, or null when they are on none. Row-level security shows a member only their own card, its
 * unit and its phones, so `supabase` must act as that person. The unit names its columns: `record_phone` is not granted
 * to signed-in users, and a `*` (or `units(*)`) on it is refused.
 */
export async function loadMyCard(supabase: SupabaseClient, userId: string): Promise<CardSummary | null> {
  const { data: member, error } = await supabase
    .from('card_members')
    // The policy shows every member of the card, so the row is picked by who is asking.
    .select('role, card:cards(id, status, suspended_reason, places, phone_limit, unit:units(label, lease_end))')
    .eq('user_id', userId)
    .maybeSingle()
    // PostgREST sends a to-one embed as an object; without generated schema types the client guesses an array.
    .overrideTypes<MemberRow, { merge: false }>();
  if (error) throw new Error(`card lookup failed: ${error.message}`);
  if (!member) return null;

  const { card } = member;
  const [phones, waiting] = await Promise.all([
    supabase.from('card_phones').select('id', { count: 'exact', head: true }).eq('card_id', card.id),
    // Row-level security shows a person only their own phone's keys, so this asks about their own phone and no one else's.
    supabase.from('phone_keys').select('id', { count: 'exact', head: true }).eq('state', 'waiting'),
  ]);
  if (phones.error) throw new Error(`card phones lookup failed: ${phones.error.message}`);
  if (waiting.error) throw new Error(`card keys lookup failed: ${waiting.error.message}`);

  return {
    id: card.id,
    unit: card.unit.label,
    places: card.places,
    suspended: card.status === 'suspended',
    reason: card.suspended_reason,
    leaseEnd: card.unit.lease_end,
    phones: phones.count ?? 0,
    phoneLimit: card.phone_limit,
    role: member.role,
    moveWaiting: (waiting.count ?? 0) > 0,
  };
}
