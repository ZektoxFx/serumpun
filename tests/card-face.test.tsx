// Beyond the brief's device tests: what the closed card says, in the states the live demo cannot be put into on demand.
import { renderToStaticMarkup } from 'react-dom/server';
// The card calls these server actions from effects and handlers only, which a static render never reaches.
vi.mock('@/app/(app)/me/card/actions', () => ({ renewPass: vi.fn(), checkCardPin: vi.fn(), moveCard: vi.fn(), declineMove: vi.fn() }));
import { moveCard } from '@/app/(app)/me/card/actions';
import { HouseholdCard } from '@/components/card/HouseholdCard';
import { MoveQuestion } from '@/components/card/MoveQuestion';
import type { PinAnswer } from '@/lib/card/pin';
import type { CardSummary } from '@/lib/card/summary';

// The real PIN sheet, with its props kept so that a test can ask the PIN check the question hands it.
const sheets = vi.hoisted(() => [] as Array<{ check: (pin: string) => Promise<PinAnswer>; onDone: () => void }>);
vi.mock('@/components/card/PinSheet', async (importOriginal) => {
  const { PinSheet } = await importOriginal<typeof import('@/components/card/PinSheet')>();
  return { PinSheet: (props: Parameters<typeof PinSheet>[0]) => (sheets.push(props), PinSheet(props)) };
});

const summary: CardSummary = {
  id: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', places: ['facilities', 'gym', 'pool'], suspended: false, reason: null,
  leaseEnd: null, phones: 3, phoneLimit: 4, role: 'owner', moveWaiting: false,
};
const card = (over: Partial<CardSummary> = {}) => renderToStaticMarkup(<HouseholdCard summary={{ ...summary, ...over }} demoPin={null} />);

it('shows the unit, the places and the phones on a card that is closed until the PIN', () => {
  const html = card();
  expect(html).toContain('No. 18, Jalan Elmina Valley 3/2');
  expect(html).toContain('Facilities · Gym · Pool');
  expect(html).toContain('3 of 4');
  expect(html).toContain('Tap to open');
  expect(html).toContain('<button');
  expect(html).not.toContain('Hold near a reader'); // that is the open card
});
it('says "None" for a card with every place switched off', () => {
  expect(card({ places: [] })).toContain('None');
});
it('says why a suspended card will not open doors, and still lets it open so the reader can show the red result', () => {
  const html = card({ suspended: true, reason: 'Rent overdue' });
  expect(html).toContain('Suspended · Rent overdue');
  expect(html).toContain('Tap to open');
});
it('says "Lease ended" once the last day has passed, and not before', () => {
  expect(card({ leaseEnd: '2020-01-01' })).toContain('Lease ended');
  expect(card({ leaseEnd: '2099-12-31' })).not.toContain('Lease ended');
});
it('gives a suspended card its own word over a lease that has ended too, as the reader does', () => {
  const html = card({ suspended: true, reason: 'Rent overdue', leaseEnd: '2020-01-01' });
  expect(html).toContain('Suspended · Rent overdue');
  expect(html).not.toContain('Lease ended');
});
it('asks the old phone whether to move the card, with Yes and No', () => {
  const html = renderToStaticMarkup(<MoveQuestion cardId="c18" device={{ keys: {} as CryptoKeyPair, pass: 'p' }} onMoved={() => {}} />);
  for (const text of ['Move the card to your new phone?', 'Yes, move it', 'No, that wasn&#x27;t me']) expect(html).toContain(text);
});

describe('the move question asks the server with a note this browser signs, and reads its answer', () => {
  /** The PIN check the question hands its sheet, when the server answers `answer`. */
  async function check(answer: PinAnswer) {
    vi.mocked(moveCard).mockResolvedValue(answer);
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    renderToStaticMarkup(<MoveQuestion cardId="c18" device={{ keys, pass: 'a.b' }} onMoved={() => {}} />);
    return sheets.at(-1)!.check('123456');
  }

  // move_phone_key refuses with not_this_phone before it looks at the PIN: this browser's key is not the active one any more
  // (the card moved already, or this phone was turned away), which is where a move would have left it.
  it('takes "not this phone" for a finished move, so the pass goes and the moved note shows', async () => {
    expect(await check({ ok: false, error: 'household.error.not_this_phone' })).toEqual({ ok: true });
  });
  it('shows every other answer as the PIN pad expects it', async () => {
    for (const answer of [
      { ok: true },
      { ok: false, error: 'card.pin.error.wrong', triesLeft: 4 },
      { ok: false, error: 'household.error.nothing_waiting' },
      { ok: false, error: 'card.move.error.proof' },
    ] satisfies PinAnswer[]) {
      expect(await check(answer)).toEqual(answer);
    }
  });
});
