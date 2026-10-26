// Beyond the brief's test file: the office's Suspend, Lift and Give code actions (who may call them, what they send, what they answer).
vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ office: true, rpc: vi.fn(), refresh: vi.fn() }));
vi.mock('next/cache', () => ({ refresh: h.refresh }));
vi.mock('@/lib/supabase/auth', () => ({
  // The real one redirects, which Next implements by throwing.
  requireManagement: async () => {
    if (!h.office) throw new Error('NEXT_REDIRECT');
    return {};
  },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: h.rpc }) }));

import { giveCode, liftSuspension, suspendCard } from '@/app/dashboard/units/actions';
import { hashCode, normalizeCode } from '@/lib/card/codes';

const answer = (error: string | null) => h.rpc.mockResolvedValueOnce({ data: null, error: error && { message: error } });

beforeEach(() => {
  h.office = true;
  h.rpc.mockReset();
  h.refresh.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('suspendCard', () => {
  it("sends the card and the trimmed reason, then refreshes the page", async () => {
    answer(null);
    expect(await suspendCard('c18', "  Landlord's request \n")).toEqual({});
    expect(h.rpc).toHaveBeenCalledWith('suspend_card', { p_card: 'c18', p_reason: "Landlord's request" });
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('sends a reason that is not text as an empty one, which the database refuses', async () => {
    for (const reason of [42, null, undefined, ['x'], { trim: () => 'x' }]) {
      answer('bad_reason');
      expect(await suspendCard('c18', reason as never), String(reason)).toEqual({ error: 'units.error.bad_reason' });
      expect(h.rpc).toHaveBeenLastCalledWith('suspend_card', { p_card: 'c18', p_reason: '' });
    }
  });
  it('says each refusal in its own words, and leaves the page alone', async () => {
    for (const [code, key] of [
      ['not_management', 'units.error.not_management'],
      ['not_found', 'units.error.not_found'],
      ['bad_reason', 'units.error.bad_reason'],
    ]) {
      answer(code);
      expect(await suspendCard('c18', 'x'), code).toEqual({ error: key });
    }
    expect(h.refresh).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
  it('says something went wrong for anything else, and logs it', async () => {
    answer('boom');
    expect(await suspendCard('c18', 'x')).toEqual({ error: 'common.error' });
    expect(h.refresh).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('suspend_card failed: boom');
  });
});

describe('liftSuspension', () => {
  it('sends the card, then refreshes the page', async () => {
    answer(null);
    expect(await liftSuspension('c19')).toEqual({});
    expect(h.rpc).toHaveBeenCalledWith('lift_card_suspension', { p_card: 'c19' });
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('says a card that is not suspended is not suspended, and leaves the page alone', async () => {
    answer('not_suspended');
    expect(await liftSuspension('c19')).toEqual({ error: 'units.error.not_suspended' });
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

const record = { name: ' Zulkifli Hassan ', tenure: 'owner' as const, phone: '010-000 0061', leaseEnd: null, icSeen: true, papersSeen: true };

describe('giveCode', () => {
  it('asks the database nothing until both checks are ticked and the number is a Malaysian mobile', async () => {
    expect(await giveCode('u61', { ...record, papersSeen: false })).toEqual({ error: 'units.error.not_checked' });
    expect(await giveCode('u61', { ...record, icSeen: false })).toEqual({ error: 'units.error.not_checked' });
    // It arrives from the browser: only a real `true` counts as a tick.
    expect(await giveCode('u61', { ...record, icSeen: 'yes' as never })).toEqual({ error: 'units.error.not_checked' });
    expect(await giveCode('u61', { ...record, phone: '03-1234 5678' })).toEqual({ error: 'phone.error.format' });
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('sends the record with the number in +60 form and only the hash of a fresh code, and shows the code once', async () => {
    h.rpc.mockResolvedValueOnce({ data: '2026-10-28T04:00:00+00:00', error: null });
    const answer = (await giveCode('u61', record)) as { code: string; expiresAt: string };
    const [name, args] = h.rpc.mock.calls[0];
    expect(name).toBe('give_unit_code');
    expect(args).toMatchObject({ p_unit: 'u61', p_name: 'Zulkifli Hassan', p_tenure: 'owner', p_phone: '+60100000061', p_lease_end: null });
    expect(answer.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(args.p_code_hash).toBe(await hashCode(normalizeCode(answer.code)!));
    expect(JSON.stringify(args)).not.toContain(normalizeCode(answer.code)); // the database never sees the code itself
    expect(answer.expiresAt).toBe('2026-10-28T04:00:00.000Z');
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it("sends a tenant's lease end, and makes a new code every time", async () => {
    h.rpc.mockResolvedValue({ data: '2026-10-28T04:00:00+00:00', error: null });
    const tenant = { ...record, tenure: 'tenant' as const, leaseEnd: '2027-03-31' };
    const first = (await giveCode('u61', tenant)) as { code: string };
    const second = (await giveCode('u61', tenant)) as { code: string };
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_tenure: 'tenant', p_lease_end: '2027-03-31' });
    expect(first.code).not.toBe(second.code);
    expect(h.rpc.mock.calls[0][1].p_code_hash).not.toBe(h.rpc.mock.calls[1][1].p_code_hash);
  });
  it("names the database's refusal", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'has_card' } });
    expect(await giveCode('u18', record)).toEqual({ error: 'units.error.has_card' });
    expect(h.refresh).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
  it('says something went wrong for anything else, and logs the message but never the code or its hash', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await giveCode('u61', record)).toEqual({ error: 'common.error' });
    expect(h.refresh).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('give_unit_code failed: boom');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(h.rpc.mock.calls[0][1].p_code_hash);
  });
});

it('does nothing for anyone but the Management Office', async () => {
  h.office = false;
  await expect(suspendCard('c18', 'x')).rejects.toThrow('NEXT_REDIRECT');
  await expect(liftSuspension('c19')).rejects.toThrow('NEXT_REDIRECT');
  await expect(giveCode('u61', record)).rejects.toThrow('NEXT_REDIRECT');
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
});
