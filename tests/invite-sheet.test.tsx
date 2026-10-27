// Beyond the brief's two test files: what the invite sheet shows before anyone touches it (the roles the card allows, and why not the rest).
import { renderToStaticMarkup } from 'react-dom/server';
// The sheet and its PIN pad call these server actions from handlers only, which a static render never reaches.
vi.mock('@/app/(app)/me/household/actions', () => ({ createInvite: vi.fn(), cancelInvite: vi.fn() }));
vi.mock('@/app/(app)/me/card/actions', () => ({ renewPass: vi.fn(), checkCardPin: vi.fn() }));
import { InviteSheet } from '@/components/card/InviteSheet';
import type { InviteChoice, InviteRole } from '@/lib/card/household';

const render = (choices: Record<InviteRole, InviteChoice>, initialRole?: InviteRole) =>
  renderToStaticMarkup(<InviteSheet cardId="c18" demoPin={null} choices={choices} initialRole={initialRole} />);
/** Each role button as [its text, whether it is chosen, whether it is disabled]. */
const roles = (html: string) =>
  [...html.matchAll(/<button[^>]*role="radio"[^>]*>(.*?)<\/button>/g)].map(([tag, label]) => [label, tag.includes('aria-checked="true"'), tag.includes('disabled=""')]);

const owner = { child: true, adult: true, co_owner: true } as const;
const ownerWithCoOwner = { child: true, adult: 'needs_both', co_owner: 'has_co_owner' } as const;
const coOwner = { child: true, adult: 'needs_both', co_owner: 'not_allowed' } as const;

it('is a button until it is opened, and has no form yet', () => {
  const html = render(owner);
  expect(html).toContain('Invite someone');
  expect(html).not.toContain('Their name');
});
it('opens at once on the role it was asked for, as "Add a Co-owner" does', () => {
  const html = render(owner, 'co_owner');
  expect(html).toContain('Their name');
  expect(roles(html)).toEqual([['Child', false, false], ['Adult', false, false], ['Co-owner', true, false]]);
});
it('disables the roles a card does not allow, and says why beside them', () => {
  const html = render(ownerWithCoOwner, 'child');
  expect(roles(html)).toEqual([['Child', true, false], ['Adult', false, true], ['Co-owner', false, true]]);
  expect(html).toContain('needs the Owner and the Co-owner to agree');
  expect(html).toContain('already has a Co-owner');
});
it('tells a Co-owner that only the Owner invites a Co-owner', () => {
  const html = render(coOwner, 'child');
  expect(roles(html)[2]).toEqual(['Co-owner', false, true]);
  expect(html).toContain('Only the Owner can do this.');
});
it('starts on the first role the card allows when it is asked for one it does not', () => {
  expect(roles(render(ownerWithCoOwner, 'co_owner')).map(([, chosen]) => chosen)).toEqual([true, false, false]);
});
