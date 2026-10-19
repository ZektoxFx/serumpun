import { DEMO_CARD_RESET, DEMO_CARD_UNIT, cardRows } from '@/lib/seed/cards';
import type { People } from '@/lib/seed/people';

const now = new Date('2026-10-19T04:00:00Z'); // noon in Malaysia
const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
const { units, cards, members, phones } = cardRows(now, people);
const VERIFIED = ['ahmad', 'aisyah', 'arif', 'daniel', 'farah', 'hafiz', 'imran', 'jason', 'kavitha', 'meiLing', 'nurul', 'priya', 'ravi', 'sara', 'siti', 'weiMing'];

it('puts every verified resident on exactly one card, and nobody else', () => {
  expect(members.map((m) => m.user_id).sort()).toEqual(VERIFIED);
});
it('gives No. 18 an Owner, a Co-owner, a child and their three phones', () => {
  const at18 = members.filter((m) => m.unit_label === DEMO_CARD_UNIT);
  expect(Object.fromEntries(at18.map((m) => [m.user_id, m.role]))).toEqual({ aisyah: 'owner', imran: 'co_owner', sara: 'child' });
  expect(phones.filter((p) => p.unit_label === DEMO_CARD_UNIT).map((p) => p.label).sort()).toEqual(["Aisyah's iPhone", "Imran's Pixel", "Sara's iPhone"]);
});
it('gives each of the 14 cards exactly one Owner', () => {
  expect(cards).toHaveLength(14);
  for (const card of cards) expect(members.filter((m) => m.unit_label === card.unit_label && m.role === 'owner'), card.unit_label).toHaveLength(1);
});
it('opens all three places on every card', () => {
  for (const card of cards) expect(card.places).toEqual(['facilities', 'gym', 'pool']);
});
it("suspends one tenant's card with the landlord's reason", () => {
  const suspended = cards.filter((c) => c.status === 'suspended');
  expect(suspended.map((c) => [c.unit_label, c.suspended_reason])).toEqual([['No. 19, Jalan Elmina Green 3/2', "Landlord's request: rent unpaid"]]);
});
it('ended one lease yesterday and runs another for 180 more days, in Malaysia', () => {
  const lease = (label: string) => units.find((u) => u.label === label)!.lease_end;
  expect(lease('No. 3, Jalan Elmina Gardens 3/1')).toBe('2026-10-18');
  expect(lease('No. 7, Jalan Elmina Valley 3/4')).toBe('2027-04-17');
});
it("leaves Nur's unit and ten more without a card", () => {
  const withCard = new Set(cards.map((c) => c.unit_label));
  const without = units.filter((u) => !withCard.has(u.label)).map((u) => u.label);
  expect(without).toHaveLength(11);
  expect(without).toContain('No. 25, Jalan Elmina Green 1/3');
});
it('restores No. 18 to exactly how it was seeded', () => {
  const seeded = cards.find((c) => c.unit_label === DEMO_CARD_UNIT)!;
  expect(DEMO_CARD_RESET.card).toEqual({ status: seeded.status, suspended_reason: seeded.suspended_reason, suspended_at: seeded.suspended_at, places: seeded.places });
  expect(DEMO_CARD_RESET.phones).toEqual({ frozen_at: null });
});
