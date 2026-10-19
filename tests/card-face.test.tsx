// Beyond the brief's device tests: what the closed card says, in the states the live demo cannot be put into on demand.
import { renderToStaticMarkup } from 'react-dom/server';
// The card calls these server actions from effects and handlers only, which a static render never reaches.
vi.mock('@/app/(app)/me/card/actions', () => ({ renewPass: vi.fn(), checkCardPin: vi.fn() }));
import { HouseholdCard } from '@/components/card/HouseholdCard';
import type { CardSummary } from '@/lib/card/summary';

const summary: CardSummary = {
  id: 'c18', unit: 'No. 18, Jalan Elmina Valley 3/2', places: ['facilities', 'gym', 'pool'], suspended: false, reason: null,
  leaseEnd: null, phones: 3, phoneLimit: 4, role: 'owner',
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
