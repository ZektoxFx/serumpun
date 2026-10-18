import { CREATE_ACTIONS, HELP_LINKS, ME_LINKS, SERVICES, TABS, isActiveTab, moveItem, resolveFavourites } from '@/lib/domain/nav';
import { t } from '@/lib/i18n/core';

describe('isActiveTab', () => {
  it('is active on its own page and on anything below it', () => {
    expect(isActiveTab('/community', '/community')).toBe(true);
    expect(isActiveTab('/community/services/new', '/community')).toBe(true);
    expect(isActiveTab('/me/points', '/me')).toBe(true);
  });

  it('compares whole path segments, so /media is not /me', () => {
    expect(isActiveTab('/media', '/me')).toBe(false);
    expect(isActiveTab('/community-news', '/community')).toBe(false);
  });

  it('leaves every tab off on pages that are not a tab', () => {
    for (const tab of TABS) {
      expect(isActiveTab('/notifications', tab.href)).toBe(false);
      expect(isActiveTab('/reports', tab.href)).toBe(false);
    }
  });
});

// The links other tasks build their routes for (controller ruling, Task 4). Changing one here breaks them.
describe('route contracts', () => {
  it('bottom navigation tabs', () => {
    expect(TABS.map((tab) => tab.href)).toEqual(['/home', '/map', '/community', '/me']);
  });

  it('the six Create sheet actions', () => {
    expect(CREATE_ACTIONS.map((action) => action.href)).toEqual([
      '/reports/new',
      '/map?drop=1',
      '/community?tab=groups',
      '/community/services/new',
      '/community/share/new',
      '/community/events/new',
    ]);
  });

  it('every service and where it goes (Home favourites and More)', () => {
    expect(Object.fromEntries(SERVICES.map((s) => [s.key, s.href]))).toEqual({
      report: '/reports/new',
      issues: '/reports',
      notify: '/notices/new',
      facilities: '/book',
      map: '/map',
      groups: '/community?tab=groups',
      events: '/community?tab=events',
      services: '/community?tab=services',
      share: '/community?tab=share',
      messages: '/messages',
      'pay-parking': '/parking/pay',
      parking: '/parking',
      mall: '/malls/elmina-lakeside-mall',
      rewards: '/rewards',
    });
  });

  it('the "my stuff" rows on Me', () => {
    expect(ME_LINKS.map((row) => row.href)).toEqual([
      '/rewards?view=mine',
      '/reports?view=mine',
      '/book?view=mine',
      '/community?tab=share&view=mine',
      '/notices',
      '/me/points',
    ]);
  });

  it('the help pages', () => {
    expect(HELP_LINKS.map((l) => l.href)).toEqual(['/help/guidelines', '/help/rules', '/help/faq', '/help/terms']);
  });
});

describe('Home favourites', () => {
  it('starts with the default seven', () => {
    expect(resolveFavourites(null).map((s) => s.key)).toEqual(['pay-parking', 'notify', 'facilities', 'events', 'groups', 'services', 'rewards']);
  });

  it('skips unknown and repeated keys and keeps at most 7', () => {
    expect(resolveFavourites(['map', 'gone', 'map', 'rewards']).map((s) => s.key)).toEqual(['map', 'rewards']);
    expect(resolveFavourites(SERVICES.map((s) => s.key))).toHaveLength(7);
    expect(resolveFavourites([])).toEqual([]);
  });

  it('moves an item, and leaves the list alone for a move out of range', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 1, 5)).toEqual(['a', 'b']);
  });

  it('keeps every word of a service label short enough for a tile in both languages', () => {
    for (const s of SERVICES)
      for (const lang of ['en', 'ms'] as const)
        for (const word of t(lang, s.label).split(/\s+/)) expect(word.length, `${s.key} (${lang}): ${word}`).toBeLessThanOrEqual(12);
  });
});
