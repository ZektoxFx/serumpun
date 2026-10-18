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

// Home's favourites and More (feedback round 2, like Touch 'n Go): every service a resident can pin to Home, in More's
// groups and order. A saved favourite is just its key, so renaming a page never breaks anyone's Home.
export type ServiceKey =
  | 'report' | 'issues' | 'notify' | 'facilities' | 'map'
  | 'groups' | 'events' | 'services' | 'share' | 'messages'
  | 'pay-parking' | 'parking' | 'mall' | 'rewards';
export type ServiceGroup = 'township' | 'community' | 'mall';
export type Service = IconEntry & { key: ServiceKey; group: ServiceGroup };

export const SERVICES: readonly Service[] = [
  { key: 'report', href: '/reports/new', label: 'create.report', icon: '❗', group: 'township' },
  { key: 'issues', href: '/reports', label: 'home.tile.issues', icon: '📋', group: 'township' },
  { key: 'notify', href: '/notices/new', label: 'home.tile.notify', icon: '📝', group: 'township' },
  { key: 'facilities', href: '/book', label: 'home.tile.book', icon: '🏟️', group: 'township' },
  { key: 'map', href: '/map', label: 'nav.map', icon: '🗺️', group: 'township' },
  { key: 'groups', href: '/community?tab=groups', label: 'community.tab.groups', icon: '👥', group: 'community' },
  { key: 'events', href: '/community?tab=events', label: 'community.tab.events', icon: '📅', group: 'community' },
  { key: 'services', href: '/community?tab=services', label: 'community.tab.services', icon: '🧑‍🏫', group: 'community' },
  { key: 'share', href: '/community?tab=share', label: 'community.tab.share', icon: '🔁', group: 'community' },
  { key: 'messages', href: '/messages', label: 'service.messages', icon: '💬', group: 'community' },
  { key: 'pay-parking', href: '/parking/pay', label: 'service.payParking', icon: '🅿️', group: 'mall' },
  { key: 'parking', href: '/parking', label: 'service.parking', icon: '🚗', group: 'mall' },
  { key: 'mall', href: '/malls/elmina-lakeside-mall', label: 'service.mall', icon: '🏬', group: 'mall' },
  { key: 'rewards', href: '/rewards', label: 'home.tile.rewards', icon: '🎁', group: 'mall' },
];
export const SERVICE_GROUPS: readonly ServiceGroup[] = ['township', 'community', 'mall'];

/** Home before a resident edits it. Issue Board and Share & Lend wait in More; Report an issue has its own button. */
export const DEFAULT_FAVOURITES: readonly ServiceKey[] = ['pay-parking', 'notify', 'facilities', 'events', 'groups', 'services', 'rewards'];
/** Seven, and More as the eighth: Home stays two rows. */
export const MAX_FAVOURITES = 7;
/** Marked NEW on Home and More (this round's additions). */
export const NEW_SERVICES: readonly ServiceKey[] = ['pay-parking', 'parking', 'mall'];

/** The resident's favourites in their order: the defaults when never saved; unknown and repeated keys skipped; at most 7. */
export function resolveFavourites(saved: readonly string[] | null): Service[] {
  const favourites: Service[] = [];
  for (const key of saved ?? DEFAULT_FAVOURITES) {
    const service = SERVICES.find((s) => s.key === key);
    if (service && !favourites.includes(service)) favourites.push(service);
    if (favourites.length === MAX_FAVOURITES) break;
  }
  return favourites;
}

/** A copy of `list` with the item at `from` moved to `to`; unchanged when either is out of range. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const moved = [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return moved;
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  return moved;
}

/** The "my stuff" rows on Me. Each owning task answers to `view=mine`. */
export const ME_LINKS = [
  { href: '/rewards?view=mine', label: 'me.vouchers', icon: '🎟️' },
  { href: '/reports?view=mine', label: 'me.reports', icon: '📋' },
  { href: '/book?view=mine', label: 'me.bookings', icon: '🏸' },
  { href: '/community?tab=share&view=mine', label: 'me.listings', icon: '🔁' },
  { href: '/notices', label: 'me.notices', icon: '📝' },
  { href: '/me/points', label: 'me.pointsHistory', icon: '★' },
] as const satisfies readonly IconEntry[];

/** Me › Help & policies (feedback round 2): the four help pages, readable signed out too. */
export const HELP_LINKS = [
  { href: '/help/guidelines', label: 'help.guidelines', hint: 'help.guidelines.hint', icon: '📘' },
  { href: '/help/rules', label: 'help.rules', hint: 'help.rules.hint', icon: '📜' },
  { href: '/help/faq', label: 'help.faq', hint: 'help.faq.hint', icon: '❓' },
  { href: '/help/terms', label: 'help.terms', hint: 'help.terms.hint', icon: '📄' },
] as const satisfies readonly (IconEntry & { hint: MessageKey })[];
