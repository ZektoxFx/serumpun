// Beyond the brief's test files (Task 3's carried check). The Units page reads every home's record phone with the service
// role, but only a home with no card gets one handed to the browser, because only that home gets a code. Smoke can't see
// this: it has no page to render, so the page itself is called here with its database answers made up.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
vi.mock('server-only', () => ({}));
// Used by handlers only, which nothing here runs.
vi.mock('@/app/dashboard/units/actions', () => ({ giveCode: vi.fn(), suspendCard: vi.fn(), liftSuspension: vi.fn() }));
vi.mock('@/lib/i18n/server', () => ({ getLang: async () => 'en' }));
vi.mock('@/lib/supabase/auth', () => ({ requireManagement: async () => ({ township_id: 'elmina' }) }));

const h = vi.hoisted(() => {
  /** A query that answers `rows` whatever it is asked, and notes what it was asked when `steps` is given. */
  const chain = (rows: unknown, steps?: unknown[][]) => {
    const query: object = new Proxy({}, {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (answer: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve)
          : (...args: unknown[]) => (steps?.push([String(method), ...args]), query),
    });
    return query;
  };
  return { chain, units: [] as unknown[], phones: [] as unknown[], adminSteps: [] as unknown[][] };
});
// The office's own client reads the units (and finds no open codes); the service role reads the record phones.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (table: string) => h.chain(table === 'units' ? h.units : []) }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => h.chain(h.phones, h.adminSteps) }) }));

import UnitsPage from '@/app/dashboard/units/page';
import { GiveCode } from '@/components/dashboard/GiveCode';

type Props = Record<string, unknown>;

/** Every element of type `type` in a tree that was never rendered: the page's own answer. */
function elements(node: ReactNode, type: unknown, found: ReactElement<Props>[] = []) {
  if (Array.isArray(node)) node.forEach((child) => elements(child, type, found));
  else if (isValidElement<Props>(node)) {
    if (node.type === type) found.push(node);
    elements(node.props.children as ReactNode, type, found);
  }
  return found;
}

/** Every piece of text and every prop value in the tree: what the page hands the browser. */
function handedOver(node: unknown, out: string[] = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((child) => handedOver(child, out));
  else if (isValidElement<Props>(node)) handedOver(node.props, out);
  else if (node && typeof node === 'object') Object.values(node).forEach((value) => handedOver(value, out));
  return out;
}

const home = (id: string, no: number, card: boolean) => ({
  id,
  label: `No. ${no}, Jalan Elmina Green 5`,
  record_name: `Owner ${no}`,
  record_tenure: 'owner',
  lease_end: null,
  card: card ? { id: `c${no}`, status: 'active', suspended_reason: null, phone_limit: 4, phones: [{ count: 2 }] } : null,
});

beforeEach(() => {
  h.adminSteps.length = 0;
  // No. 3 and No. 64 registered with an office code, so they keep their record phone and now have a card.
  h.units = [home('u3', 3, true), home('u61', 61, false), home('u62', 62, false), home('u63', 63, false), home('u64', 64, true)];
  h.phones = [
    { id: 'u3', record_phone: '+60100000003' },
    { id: 'u61', record_phone: '+60100000061' },
    { id: 'u62', record_phone: null },
    { id: 'u63', record_phone: '+60312345678' }, // a landline: no SMS code can go to it
    { id: 'u64', record_phone: '+60100000064' },
  ];
});

it("hands the browser the record phone of each home with no card, and of no home that has one", async () => {
  const page = await UnitsPage();
  // Each home's Give code starts from its own number, or from nothing when it has none that an SMS can reach.
  expect(elements(page, GiveCode).map((give) => [give.props.unit, (give.props.record as { phone: string }).phone])).toEqual([
    ['u61', '+60 10-000 0061'],
    ['u62', ''],
    ['u63', ''],
  ]);
  const sent = handedOver(page).join('\n');
  expect(sent).toContain('0061'); // the walk does see a phone, so the two absences below mean something
  expect(sent).not.toContain('0003');
  expect(sent).not.toContain('0064');
});

it("reads the phones for the office's own township only", async () => {
  await UnitsPage();
  expect(h.adminSteps).toEqual([
    ['select', 'id, record_phone'],
    ['eq', 'township_id', 'elmina'],
  ]);
});
