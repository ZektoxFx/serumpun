import type { SupabaseClient } from '@supabase/supabase-js';
import { PLACES, type Place } from '@/lib/card/crypto';
import { DEMO_PIN } from '@/lib/card/pin';
import { mytDate } from '@/lib/domain/time';
import { ROSTER, type People, type PersonKey } from './people';

const DAY = 86_400_000;

/** Aisyah's home, and the card that "Try as Aisyah" puts back the way it was seeded. */
export const DEMO_CARD_UNIT = 'No. 18, Jalan Elmina Valley 3/2';

// Rows are keyed by the unit's label, because the ids come from the database: seedCards reads them back.
export type UnitRow = { label: string; neighbourhood: string; record_name: string; record_tenure: 'owner' | 'tenant'; record_phone: string | null; lease_end: string | null };
export type CardRow = { unit_label: string; status: 'active' | 'suspended'; suspended_reason: string | null; suspended_at: string | null; places: Place[] };
export type MemberRow = { unit_label: string; user_id: string; role: 'owner' | 'co_owner' | 'adult' | 'child'; ic_checked_at: string | null };
export type PhoneRow = { unit_label: string; user_id: string; label: string };

/** A card as it is seeded, and as restoreDemoCard leaves No. 18's: working, with every place on and no phone frozen. */
export const DEMO_CARD_RESET: { card: Pick<CardRow, 'status' | 'suspended_reason' | 'suspended_at' | 'places'>; phones: { frozen_at: null } } = {
  card: { status: 'active', suspended_reason: null, suspended_at: null, places: [...PLACES] },
  phones: { frozen_at: null },
};

// The first person listed at a home is on the office's record, and owns the home unless they are a tenant here.
/** The tenants: days from today to the end of the lease (below 0: it ended), or null when no end is on record. */
const TENANTS: Partial<Record<PersonKey, number | null>> = { daniel: 180, jason: null, kavitha: -1 };
/** The cards the office has suspended, and how many days ago. */
const SUSPENDED: Partial<Record<PersonKey, { daysAgo: number; reason: string }>> = {
  jason: { daysAgo: 2, reason: "Landlord's request: rent unpaid" },
};
/** Everyone is the Owner of their own card but the two others on Aisyah's. */
const ROLES: Partial<Record<PersonKey, MemberRow['role']>> = { imran: 'co_owner', sara: 'child' };
/** Aisyah's household has named phones; everyone else's is "<first name>'s phone". */
const PHONES: Partial<Record<PersonKey, string>> = { aisyah: "Aisyah's iPhone", imran: "Imran's Pixel", sara: "Sara's iPhone" };
/** The owners of No. 61 to 70 on Jalan Elmina Green 5: homes in the township that nobody has a card for yet. */
const UNREGISTERED_OWNERS = [
  'Zulkifli Hassan', 'Lim Boon Huat', 'Rohana Ismail', 'Subramaniam Pillai', 'Tan Siew Lan',
  'Azman Yusof', 'Nor Aziah Abdullah', 'Chong Wei Jie', 'Mohan Raj', 'Faridah Salleh',
];

/**
 * A unit for every home among the seeded people, and a card for each with a verified resident on it (Nur waits for
 * approval, so her unit has none), with its people and their phones. Then ten units nobody has a card for.
 */
export function cardRows(now: Date, people: People) {
  const inDays = (days: number) => mytDate(new Date(now.getTime() + days * DAY));
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const units: UnitRow[] = [];
  const cards: CardRow[] = [];
  const members: MemberRow[] = [];
  const phones: PhoneRow[] = [];

  for (const [key, person] of ROSTER) {
    const label = person.unit;
    if (!label) continue; // the Management Office has no home here
    if (!units.some((u) => u.label === label)) {
      const lease = TENANTS[key];
      units.push({
        label,
        neighbourhood: person.neighbourhood,
        record_name: person.name,
        record_tenure: lease === undefined ? 'owner' : 'tenant',
        record_phone: null, // stage 2 fills it in
        lease_end: typeof lease === 'number' ? inDays(lease) : null,
      });
    }
    if (person.status !== 'verified') continue;
    if (!cards.some((c) => c.unit_label === label)) {
      const suspension = SUSPENDED[key];
      cards.push(
        suspension
          ? { unit_label: label, ...DEMO_CARD_RESET.card, status: 'suspended', suspended_reason: suspension.reason, suspended_at: daysAgo(suspension.daysAgo) }
          : { unit_label: label, ...DEMO_CARD_RESET.card },
      );
    }
    const role = ROLES[key] ?? 'owner';
    members.push({
      unit_label: label,
      user_id: people.ids[key],
      role,
      ic_checked_at: role === 'owner' || role === 'co_owner' ? daysAgo(person.joinedDaysAgo) : null, // the day they joined
    });
    phones.push({ unit_label: label, user_id: people.ids[key], label: PHONES[key] ?? `${person.name.split(' ')[0]}'s phone` });
  }
  UNREGISTERED_OWNERS.forEach((name, i) =>
    units.push({
      label: `No. ${61 + i}, Jalan Elmina Green 5`,
      neighbourhood: 'Elmina Green',
      record_name: name,
      record_tenure: 'owner',
      record_phone: null,
      lease_end: null,
    }),
  );
  return { units, cards, members, phones };
}

/** Saves rows on the table's natural key and answers them with the ids the database gave. It deletes nothing. */
async function upsert(admin: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  const { data, error } = await admin.from(table).upsert(rows, { onConflict }).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

/**
 * The units, the cards, who is on them and their phones, and everyone's PIN set to the demo one. Every write is an upsert
 * on a natural key, with no ids of its own, so it runs in a reset and again on a database that already has them.
 */
export async function seedCards(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { units, cards, members, phones } = cardRows(now, people);
  const savedUnits = await upsert(admin, 'units', units.map((u) => ({ ...u, township_id: people.townshipId })), 'township_id,label');
  const unitId = new Map<string, string>(savedUnits.map((u) => [u.label, u.id]));
  const savedCards = await upsert(
    admin,
    'cards',
    cards.map(({ unit_label, ...card }) => ({ ...card, township_id: people.townshipId, unit_id: unitId.get(unit_label) })),
    'unit_id',
  );
  const cardId = new Map<string, string>(savedCards.map((c) => [c.unit_id, c.id]));
  const cardOf = (label: string) => cardId.get(unitId.get(label)!);
  const savedMembers = await upsert(admin, 'card_members', members.map(({ unit_label, ...m }) => ({ ...m, card_id: cardOf(unit_label) })), 'user_id');
  const savedPhones = await upsert(admin, 'card_phones', phones.map(({ unit_label, ...p }) => ({ ...p, card_id: cardOf(unit_label) })), 'card_id,label');
  const { error } = await admin.rpc('set_member_pins', { p_users: members.map((m) => m.user_id), p_pin: DEMO_PIN });
  if (error) throw new Error(`set_member_pins: ${error.message}`);
  console.log(
    `cards: ${savedUnits.length} units, ${savedCards.length} cards, ${savedMembers.length} people on cards, ${savedPhones.length} phones, PINs set`,
  );
}

/** Puts No. 18's card and phones back the way they were seeded: "Try as Aisyah" runs it before each sign-in. */
export async function restoreDemoCard(admin: SupabaseClient): Promise<void> {
  const { data: unit, error: unitError } = await admin.from('units').select('id').eq('label', DEMO_CARD_UNIT).single();
  if (unitError) throw new Error(`units: ${unitError.message}`);
  const { data: card, error: cardError } = await admin.from('cards').update(DEMO_CARD_RESET.card).eq('unit_id', unit.id).select('id').single();
  if (cardError) throw new Error(`cards: ${cardError.message}`);
  const { error: phoneError } = await admin.from('card_phones').update(DEMO_CARD_RESET.phones).eq('card_id', card.id);
  if (phoneError) throw new Error(`card_phones: ${phoneError.message}`);
}
