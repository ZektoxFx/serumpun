// Beyond the brief's test file: the office's Suspend and Lift actions (who may call them, what they send, what they answer).
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

import { liftSuspension, suspendCard } from '@/app/dashboard/units/actions';

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

it('does nothing for anyone but the Management Office', async () => {
  h.office = false;
  await expect(suspendCard('c18', 'x')).rejects.toThrow('NEXT_REDIRECT');
  await expect(liftSuspension('c19')).rejects.toThrow('NEXT_REDIRECT');
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
});
