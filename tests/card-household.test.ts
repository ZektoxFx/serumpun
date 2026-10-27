import { householdErrorKey, inviteChoices, isCardFull, isManager, loadHousehold, type InviteRole, type Member } from '@/lib/card/household';
import { t } from '@/lib/i18n';

const aisyah: Member = { userId: 'a', role: 'owner', icChecked: true };
const imran: Member = { userId: 'i', role: 'co_owner', icChecked: true };
const sara: Member = { userId: 's', role: 'child', icChecked: false };
const nur: Member = { userId: 'n', role: 'owner', icChecked: true };
const rizal: Member = { userId: 'r', role: 'co_owner', icChecked: false };
const card = (members: Member[], openInviteRoles: InviteRole[] = []) => ({ members, openInviteRoles });

it('lets an Owner with a checked Co-owner add a child alone; an adult waits for two-person approvals', () => {
  expect(inviteChoices(aisyah, card([aisyah, imran, sara]))).toEqual({ child: true, adult: 'needs_both', co_owner: 'has_co_owner' });
  expect(inviteChoices(imran, card([aisyah, imran, sara]))).toEqual({ child: true, adult: 'needs_both', co_owner: 'not_allowed' });
  expect(inviteChoices(sara, card([aisyah, imran, sara]))).toEqual({ child: 'not_allowed', adult: 'not_allowed', co_owner: 'not_allowed' });
});
it('lets an Owner alone on the card invite anyone, and holds the Co-owner place for an open invite', () => {
  expect(inviteChoices(nur, card([nur]))).toEqual({ child: true, adult: true, co_owner: true });
  expect(inviteChoices(nur, card([nur], ['co_owner'])).co_owner).toBe('has_co_owner');
});
it('counts a Co-owner whose IC is not checked as an adult', () => {
  expect(inviteChoices(nur, card([nur, rizal]))).toEqual({ child: true, adult: true, co_owner: 'has_co_owner' });
  expect(inviteChoices(rizal, card([nur, rizal]))).toEqual({ child: 'not_allowed', adult: 'not_allowed', co_owner: 'not_allowed' });
});
it('names every household refusal in both languages', () => {
  for (const code of ['no_card', 'not_allowed', 'bad_role', 'has_co_owner', 'needs_both', 'bad_name', 'name_taken', 'card_full', 'not_found']) {
    expect(householdErrorKey(code), code).not.toBe('common.error');
    expect(t('ms', householdErrorKey(code))).not.toBe(t('en', householdErrorKey(code)));
  }
  expect(householdErrorKey('__proto__')).toBe('common.error');
});

// Beyond the brief: the other ways in, and what the page reads.
it('says anything unexpected, or nothing at all, is the generic error', () => {
  expect(householdErrorKey(undefined)).toBe('common.error');
  expect(householdErrorKey('toString')).toBe('common.error');
  expect(householdErrorKey('canceling statement due to statement timeout')).toBe('common.error');
});
it('makes the Owner, and a Co-owner whose IC the office has checked, the managers', () => {
  expect([aisyah, imran, nur].map(isManager)).toEqual([true, true, true]);
  expect([rizal, sara, { role: 'adult' as const, icChecked: true }].map(isManager)).toEqual([false, false, false]);
});
it("gives every reason a disabled role shows its own words in both languages", () => {
  for (const choice of ['not_allowed', 'needs_both', 'has_co_owner'] as const) {
    expect(t('en', householdErrorKey(choice)), choice).not.toBe(householdErrorKey(choice));
    expect(t('ms', householdErrorKey(choice)), choice).not.toBe(t('en', householdErrorKey(choice)));
  }
});

// A full card: the count create_invite makes before it asks for the PIN (0025), so the page can say so first.
it('calls a card full when its phones and its open invites fill every place', () => {
  const at18 = { phones: 3, phoneLimit: 4 }; // "3 of 4 phones"
  expect(isCardFull(at18, 0)).toBe(false);
  expect(isCardFull(at18, 1)).toBe(true); // an open invite holds the fourth place
  expect(isCardFull({ phones: 4, phoneLimit: 4 }, 0)).toBe(true);
  expect(isCardFull({ phones: 2, phoneLimit: 4 }, 1)).toBe(false);
  expect(isCardFull({ phones: 2, phoneLimit: 4 }, 2)).toBe(true);
  expect(isCardFull({ phones: 4, phoneLimit: 4 }, 3)).toBe(true); // a count past the limit is still full
  expect(isCardFull({ phones: 1, phoneLimit: 1 }, 0)).toBe(true); // whatever the limit is
});
it('says in both languages that a full card has no place until an invite is cancelled', () => {
  expect(t('en', 'household.full')).toBe(
    'Every phone place is taken or held by an open invite. Cancel an invite, or ask the office for an extra card.',
  );
  expect(t('ms', 'household.full')).not.toBe(t('en', 'household.full'));
});

type Step = [method: string, ...args: unknown[]];
type Answer = { data: unknown; error: { message: string } | null };
/** Records each query's steps and answers it from `answers[table]` when it is awaited, as the real builder does. */
function fakeDb(answers: Record<string, Answer>) {
  const queries: { table: string; steps: Step[] }[] = [];
  const client = {
    from(table: string) {
      const steps: Step[] = [];
      const query: object = new Proxy({}, {
        get: (_, method) =>
          method === 'then'
            ? (resolve: (answer: Answer) => unknown) => {
                queries.push({ table, steps });
                return Promise.resolve(answers[table]).then(resolve);
              }
            : (...args: unknown[]) => (steps.push([String(method), ...args]), query),
      });
      return query;
    },
  };
  const on = (table: string) => queries.find((q) => q.table === table)!.steps;
  return { client: client as never, on };
}
const rows = (...data: unknown[]): Answer => ({ data, error: null });
const now = new Date('2026-10-27T04:00:00Z');
const member = (user_id: string, name: string, role: string, ic_checked_at: string | null = null) => ({ user_id, role, ic_checked_at, profile: { full_name: name } });

it('reads the people on a card with their names, Owner first and children last, and whether the office has checked an IC', async () => {
  const db = fakeDb({
    card_members: rows(member('s', 'Sara', 'child'), member('r', 'Rizal', 'co_owner'), member('a', 'Aisyah Rahman', 'owner', '2026-10-01T00:00:00Z'), member('d', 'Dewi', 'adult')),
    card_codes: rows(),
  });
  const household = await loadHousehold(db.client, 'c18', 'r', now);
  expect(household.people).toEqual([
    { userId: 'a', name: 'Aisyah Rahman', role: 'owner', icChecked: true },
    { userId: 'r', name: 'Rizal', role: 'co_owner', icChecked: false },
    { userId: 'd', name: 'Dewi', role: 'adult', icChecked: false },
    { userId: 's', name: 'Sara', role: 'child', icChecked: false },
  ]);
  expect(household.me.userId).toBe('r');
  // Rizal's IC is not checked, so he is no manager and may invite no one.
  expect(household.choices).toEqual({ child: 'not_allowed', adult: 'not_allowed', co_owner: 'not_allowed' });
  expect(db.on('card_members')).toContainEqual(['eq', 'card_id', 'c18']);
});
it('reads only the invites of this card that nobody has used or cancelled and that have not run out', async () => {
  const db = fakeDb({
    card_members: rows(member('a', 'Aisyah Rahman', 'owner', '2026-10-01T00:00:00Z'), member('i', 'Imran', 'co_owner', '2026-10-02T00:00:00Z')),
    card_codes: rows({ id: 'x1', name: 'Adam', role: 'child', created_by: 'a', expires_at: '2026-10-29T04:00:00+00:00' }),
  });
  const household = await loadHousehold(db.client, 'c18', 'a', now);
  expect(household.invites).toEqual([{ id: 'x1', name: 'Adam', role: 'child', createdBy: 'a', expiresAt: '2026-10-29T04:00:00+00:00' }]);
  const steps = db.on('card_codes');
  expect(steps).toEqual(expect.arrayContaining([
    ['eq', 'card_id', 'c18'], ['eq', 'kind', 'invite'], ['is', 'used_at', null], ['is', 'cancelled_at', null], ['gt', 'expires_at', now.toISOString()],
  ]));
  // The Owner of a card with a checked Co-owner adds a child alone.
  expect(household.choices).toEqual({ child: true, adult: 'needs_both', co_owner: 'has_co_owner' });
});
it('holds the Co-owner place for an invite that is still open', async () => {
  const db = fakeDb({
    card_members: rows(member('n', 'Nur Iman', 'owner', '2026-10-01T00:00:00Z')),
    card_codes: rows({ id: 'x2', name: 'Farid', role: 'co_owner', created_by: 'n', expires_at: '2026-10-29T04:00:00+00:00' }),
  });
  expect((await loadHousehold(db.client, 'c25', 'n', now)).choices.co_owner).toBe('has_co_owner');
});
it('fails loudly when a lookup fails, or when the caller is not on the card it was asked about', async () => {
  const failed = fakeDb({ card_members: { data: null, error: { message: 'boom' } }, card_codes: rows() });
  await expect(loadHousehold(failed.client, 'c18', 'a', now)).rejects.toThrow('card members lookup failed: boom');
  const stranger = fakeDb({ card_members: rows(member('a', 'Aisyah Rahman', 'owner')), card_codes: rows() });
  await expect(loadHousehold(stranger.client, 'c18', 'zz', now)).rejects.toThrow('not on this card');
});
