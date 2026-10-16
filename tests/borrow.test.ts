import { BORROW_STEPS, LISTING_KINDS, borrowMoves, canAdvanceBorrow, shareErrorKey } from '@/lib/domain/community';
import { neighbourhoodDistance } from '@/lib/domain/places';
import { mytDate } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { communityRows } from '@/lib/seed/community';
import type { People } from '@/lib/seed/people';

describe('canAdvanceBorrow', () => {
  it('lets the owner approve a request, and not the borrower', () => {
    expect(canAdvanceBorrow('requested', 'approved', 'owner')).toBe(true);
    expect(canAdvanceBorrow('requested', 'approved', 'borrower')).toBe(false);
  });
  it('ends at returned, for both', () => {
    for (const to of [...BORROW_STEPS, 'declined', 'cancelled'] as const) {
      expect(canAdvanceBorrow('returned', to, 'owner'), to).toBe(false);
      expect(canAdvanceBorrow('returned', to, 'borrower'), to).toBe(false);
    }
  });
  it('lets the borrower cancel until the pick-up', () => {
    expect(canAdvanceBorrow('requested', 'cancelled', 'borrower')).toBe(true);
    expect(canAdvanceBorrow('approved', 'cancelled', 'borrower')).toBe(true);
    expect(canAdvanceBorrow('picked_up', 'cancelled', 'borrower')).toBe(false);
  });
  it('skips no step', () => {
    expect(canAdvanceBorrow('requested', 'picked_up', 'owner')).toBe(false);
    expect(canAdvanceBorrow('approved', 'returned', 'owner')).toBe(false);
  });
  it('walks the four steps in order for the owner', () => {
    expect(BORROW_STEPS.slice(1).every((to, i) => canAdvanceBorrow(BORROW_STEPS[i], to, 'owner'))).toBe(true);
    expect(borrowMoves('requested', 'owner')).toEqual(['approved', 'declined']);
    expect(borrowMoves('picked_up', 'borrower')).toEqual([]);
  });
});

describe('neighbourhoodDistance', () => {
  it('is 0 within a neighbourhood, however it is typed', () => {
    expect(neighbourhoodDistance('Elmina Valley 3', ' elmina valley 3 ')).toBe(0);
  });
  it('is the distance between two centres, either way round', () => {
    const d = neighbourhoodDistance('Elmina Valley 3', 'Elmina Gardens')!;
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(5000);
    expect(neighbourhoodDistance('Elmina Gardens', 'Elmina Valley 3')).toBe(d);
  });
  it('is unknown off the list', () => {
    expect(neighbourhoodDistance('Elmina Valley 3', 'Taman Lain')).toBeNull();
  });
});

it('names every Share & Lend error, kind and status in both languages', () => {
  const codes = [
    'not_verified', 'not_found', 'bad_kind', 'bad_title', 'bad_dates', 'not_lendable', 'own_listing',
    'already_requested', 'not_allowed', 'bad_step', 'overlap', 'on_loan', 'not_member',
  ];
  for (const code of codes) {
    const key = shareErrorKey(code);
    expect(key, code).not.toBe('common.error');
    expect(t('ms', key)).not.toBe(t('en', key));
  }
  expect(shareErrorKey('__proto__')).toBe('common.error');
  const keys = [
    ...LISTING_KINDS.map((kind) => `share.kind.${kind}` as const),
    ...([...BORROW_STEPS, 'declined', 'cancelled'] as const).map((status) => `share.status.${status}` as const),
  ];
  for (const key of keys) {
    expect(t('en', key)).not.toBe(key);
    expect(t('ms', key)).not.toBe(t('en', key));
  }
});

describe('the seeded listings', () => {
  const now = new Date('2026-10-16T06:00:00Z');
  const people = { townshipId: 'elmina', ids: new Proxy({}, { get: (_, key) => String(key) }) } as People;
  const { listings, borrows } = communityRows(now, people);

  it('open with the six cards of the approved canvas, among 12', () => {
    expect(listings).toHaveLength(12);
    const newest = [...listings].sort((a, b) => b.created_at.localeCompare(a.created_at));
    expect(newest.slice(0, 6).map((l) => [l.emoji, l.title, l.kind, l.owner_id])).toEqual([
      ['🪜', 'Aluminium ladder (6 ft)', 'lend', 'ahmad'],
      ['👶', 'Baby stroller', 'lend', 'priya'],
      ['📚', 'Form 3 textbooks', 'give', 'meiLing'],
      ['🪴', 'Monstera ↔ herbs', 'swap', 'nurul'],
      ['🛠️', 'Cordless drill', 'lend', 'ravi'],
      ['🏸', 'Badminton rackets', 'lend', 'daniel'],
    ]);
  });

  it("give Aisyah one active borrow: Ahmad's ladder, approved", () => {
    expect(borrows).toHaveLength(1);
    const [borrow] = borrows;
    const ladder = listings.find((l) => l.id === borrow.listing_id)!;
    expect([ladder.title, borrow.borrower_id, borrow.status]).toEqual(['Aluminium ladder (6 ft)', 'aisyah', 'approved']);
    // As request_borrow takes them: from today on, ending on or after the start, and by the end of the lending.
    expect(borrow.from_date >= mytDate(now) && borrow.to_date >= borrow.from_date).toBe(true);
    expect(ladder.available_until === null || borrow.to_date <= ladder.available_until).toBe(true);
  });

  it('keep the rules create_listing keeps', () => {
    for (const l of listings) {
      if (l.kind !== 'swap') expect(l.swap_for, l.title).toBeNull();
      if (l.kind !== 'lend') expect(l.available_until, l.title).toBeNull();
      expect(l.owner_id, l.title).not.toBe('nur'); // still waiting for approval: lists nothing
    }
  });
});
