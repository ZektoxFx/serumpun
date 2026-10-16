import type { MessageKey } from '@/lib/i18n';

type Entry = { href: string; label: MessageKey };
type IconEntry = Entry & { icon: string };

// The routes below are shared promises: later tasks build the pages behind them, so a path changes only by agreement.

/** The bottom bar. The Create button sits between Map and Community; it is not a page. */
export const TABS = [
  { key: 'home', href: '/home', label: 'nav.home' },
  { key: 'map', href: '/map', label: 'nav.map' },
  { key: 'community', href: '/community', label: 'nav.community' },
  { key: 'me', href: '/me', label: 'nav.me' },
] as const satisfies readonly (Entry & { key: string })[];

/** A tab is lit on its own page and on every page below it. Whole segments only, so /media is not /me. */
export function isActiveTab(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The Create sheet (the + button), in the order the sheet lists them. */
export const CREATE_ACTIONS = [
  { href: '/reports/new', label: 'create.report', icon: '🛠️' },
  { href: '/map?drop=1', label: 'create.alert', icon: '⚠️' },
  { href: '/community?tab=groups', label: 'create.post', icon: '💬' },
  { href: '/community/services/new', label: 'create.service', icon: '🤝' },
  { href: '/community/share/new', label: 'create.item', icon: '🔁' },
  { href: '/community/events/new', label: 'create.event', icon: '📅' },
] as const satisfies readonly IconEntry[];

/** The eight Home tiles (brainstorm mockup "A · Tiles first"). */
export const HOME_TILES = [
  { href: '/map', label: 'home.tile.map', icon: '🗺️' },
  { href: '/book', label: 'home.tile.book', icon: '🏟️' },
  { href: '/community?tab=events', label: 'community.tab.events', icon: '📅' },
  { href: '/community?tab=groups', label: 'community.tab.groups', icon: '👥' },
  { href: '/community?tab=services', label: 'community.tab.services', icon: '🧑‍🏫' },
  { href: '/community?tab=share', label: 'community.tab.share', icon: '🔁' },
  { href: '/rewards', label: 'home.tile.rewards', icon: '🎁' },
  { href: '/reports', label: 'home.tile.issues', icon: '📋' },
] as const satisfies readonly IconEntry[];

/** The "my stuff" rows on Me. Each owning task answers to `view=mine`. */
export const ME_LINKS = [
  { href: '/rewards?view=mine', label: 'me.vouchers', icon: '🎟️' },
  { href: '/reports?view=mine', label: 'me.reports', icon: '📋' },
  { href: '/book?view=mine', label: 'me.bookings', icon: '🏸' },
  { href: '/community?tab=share&view=mine', label: 'me.listings', icon: '🔁' },
  { href: '/me/points', label: 'me.pointsHistory', icon: '★' },
] as const satisfies readonly IconEntry[];
