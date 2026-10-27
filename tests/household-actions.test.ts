vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ signedIn: true, rpc: vi.fn(), refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh: h.refresh }));
vi.mock('@/lib/supabase/auth', () => ({
  // The real one redirects, which Next implements by throwing.
  requireMember: async () => {
    if (!h.signedIn) throw new Error('NEXT_REDIRECT');
    return { id: 'u-aisyah', lang: 'en' };
  },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: h.rpc }) }));

import { approveMove, cancelInvite, createInvite } from '@/app/(app)/me/household/actions';
import { hashCode, normalizeCode } from '@/lib/card/codes';

const made = { data: { ok: true, expires_at: '2026-10-28T04:00:00+00:00' }, error: null };

beforeEach(() => {
  h.signedIn = true;
  h.rpc.mockReset();
  h.refresh.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('sends only the hash of a fresh code with the name, role and PIN, and shows the code once it is made', async () => {
  h.rpc.mockResolvedValueOnce({ data: { ok: true, expires_at: '2026-10-28T04:00:00+00:00' }, error: null });
  const answer = (await createInvite(' Adam ', 'child', '123456')) as { ok: true; code: string; expiresAt: string };
  const [name, args] = h.rpc.mock.calls[0];
  expect([name, args.p_name, args.p_role, args.p_pin]).toEqual(['create_invite', 'Adam', 'child', '123456']);
  expect(args.p_code_hash).toBe(await hashCode(normalizeCode(answer.code)!));
});
it('hands back a wrong PIN as the pad expects, and names a refusal', async () => {
  h.rpc.mockResolvedValueOnce({ data: { ok: false, tries_left: 4 }, error: null });
  expect(await createInvite('Adam', 'child', '000000')).toEqual({ ok: false, error: 'card.pin.error.wrong', triesLeft: 4 });
  h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'needs_both' } });
  expect(await createInvite('Farid', 'adult', '123456')).toEqual({ ok: false, error: 'invite.why.needs_both' });
});
it("hands back an approver's wrong PIN, and names a refusal", async () => {
  h.rpc.mockResolvedValueOnce({ data: { ok: false, tries_left: 2 }, error: null });
  expect(await approveMove('u-sara', '000000')).toEqual({ ok: false, error: 'card.pin.error.wrong', triesLeft: 2 });
  h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'nothing_waiting' } });
  expect(await approveMove('u-sara', '123456')).toEqual({ ok: false, error: 'household.error.nothing_waiting' });
});

// Beyond the brief: the rules around those two.
describe('createInvite', () => {
  it('turns away a PIN that is not six digits without a call, so it costs no try', async () => {
    for (const pin of ['12345', '1234567', '12345a', 123456, ['123456'], null]) {
      expect(await createInvite('Adam', 'child', pin as never), String(pin)).toEqual({ ok: false, error: 'card.pin.error.format' });
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('shows the code the way people read it, with when it runs out, and refreshes the page behind the sheet', async () => {
    h.rpc.mockResolvedValueOnce(made);
    const answer = (await createInvite('Adam', 'child', '123456')) as { ok: true; code: string; expiresAt: string };
    expect(answer).toEqual({ ok: true, code: expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/), expiresAt: '2026-10-28T04:00:00.000Z' });
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('never sends the code itself, and makes a new one every time', async () => {
    h.rpc.mockResolvedValue(made);
    const first = (await createInvite('Adam', 'child', '123456')) as { code: string };
    const second = (await createInvite('Adam', 'child', '123456')) as { code: string };
    expect(first.code).not.toBe(second.code);
    expect(h.rpc.mock.calls[0][1].p_code_hash).not.toBe(h.rpc.mock.calls[1][1].p_code_hash);
    expect(JSON.stringify(h.rpc.mock.calls[0][1])).not.toContain(normalizeCode(first.code)!);
  });
  it('sends a name that is not text as an empty one, which the database refuses as bad_name', async () => {
    for (const name of [42, null, undefined, ['Adam'], { trim: () => 'Adam' }]) {
      h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'bad_name' } });
      expect(await createInvite(name as never, 'child', '123456'), String(name)).toEqual({ ok: false, error: 'household.error.bad_name' });
      expect(h.rpc.mock.lastCall![1].p_name).toBe('');
    }
  });
  it('leaves the page alone after a wrong PIN or a refusal', async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: false, tries_left: 4 }, error: null });
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'card_full' } });
    await createInvite('Adam', 'child', '000000');
    await createInvite('Adam', 'child', '123456');
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it("names each refusal in the household's own words", async () => {
    for (const [code, key] of [
      ['no_card', 'card.error.no_card'],
      ['card_full', 'card.error.card_full'],
      ['not_allowed', 'household.error.not_allowed'],
      ['has_co_owner', 'invite.why.has_co_owner'],
      ['name_taken', 'household.error.name_taken'],
      ['bad_role', 'household.error.bad_role'],
    ]) {
      h.rpc.mockResolvedValueOnce({ data: null, error: { message: code } });
      expect(await createInvite('Adam', 'child', '123456'), code).toEqual({ ok: false, error: key });
    }
    expect(console.error).not.toHaveBeenCalled();
  });
  it('tells a locked PIN when it opens again, in the resident\'s language', async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: false, locked_until: '2026-10-27T04:15:00+00:00' }, error: null });
    expect(await createInvite('Adam', 'child', '123456')).toMatchObject({ ok: false, error: 'card.pin.error.locked', lockedUntil: '2026-10-27T04:15:00.000Z' });
  });
  it('says something went wrong for anything else, and logs the message but never the code, the PIN or the hash', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await createInvite('Adam', 'child', '123456')).toEqual({ ok: false, error: 'common.error' });
    expect(console.error).toHaveBeenCalledWith('create_invite failed: boom');
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(h.rpc.mock.calls[0][1].p_code_hash);
    expect(logged).not.toContain('123456');
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

describe('cancelInvite', () => {
  it('cancels the invite it is given, then refreshes the page', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await cancelInvite('inv-1')).toEqual({});
    expect(h.rpc).toHaveBeenCalledWith('cancel_invite', { p_invite: 'inv-1' });
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('names a refusal, and still refreshes: the page was out of date, so the invite should not stay on it', async () => {
    for (const [code, key] of [['not_found', 'household.error.not_found'], ['not_allowed', 'household.error.not_allowed']]) {
      h.rpc.mockResolvedValueOnce({ data: null, error: { message: code } });
      expect(await cancelInvite('inv-1'), code).toEqual({ error: key });
    }
    expect(h.refresh).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });
  it('says something went wrong for anything else, and logs it', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await cancelInvite('inv-1')).toEqual({ error: 'common.error' });
    expect(console.error).toHaveBeenCalledWith('cancel_invite failed: boom');
  });
});

describe('approveMove', () => {
  it('turns away a PIN that is not six digits without a call, so it costs no try', async () => {
    for (const pin of ['12345', 123456, null]) {
      expect(await approveMove('u-sara', pin as never), String(pin)).toEqual({ ok: false, error: 'card.pin.error.format' });
    }
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it('approves the person it is given as the signed-in manager, with their PIN, then refreshes the page', async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await approveMove('u-sara', '123456')).toEqual({ ok: true });
    expect(h.rpc).toHaveBeenCalledWith('approve_phone_move', { p_member: 'u-sara', p_pin: '123456' });
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('refreshes after a refusal too: the page was out of date, so the waiting phone should not stay on it', async () => {
    for (const [code, key] of [['nothing_waiting', 'household.error.nothing_waiting'], ['not_allowed', 'household.error.not_allowed'], ['not_found', 'household.error.not_found']]) {
      h.rpc.mockResolvedValueOnce({ data: null, error: { message: code } });
      expect(await approveMove('u-sara', '123456'), code).toEqual({ ok: false, error: key });
    }
    expect(h.refresh).toHaveBeenCalledTimes(3);
    expect(console.error).not.toHaveBeenCalled();
  });
  it('says something went wrong for anything else, and logs the message but never the PIN', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await approveMove('u-sara', '123456')).toEqual({ ok: false, error: 'common.error' });
    expect(console.error).toHaveBeenCalledWith('approve_phone_move failed: boom');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('123456');
  });
});

it('does nothing for someone who is not signed in', async () => {
  h.signedIn = false;
  await expect(createInvite('Adam', 'child', '123456')).rejects.toThrow('NEXT_REDIRECT');
  await expect(cancelInvite('inv-1')).rejects.toThrow('NEXT_REDIRECT');
  await expect(approveMove('u-sara', '123456')).rejects.toThrow('NEXT_REDIRECT');
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
});
