import { CREATE_ACTIONS, HOME_TILES, ME_LINKS, TABS, isActiveTab } from '@/lib/domain/nav';

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

  it('the eight Home tiles', () => {
    expect(HOME_TILES.map((tile) => tile.href)).toEqual([
      '/map',
      '/book',
      '/community?tab=events',
      '/community?tab=groups',
      '/community?tab=services',
      '/community?tab=share',
      '/rewards',
      '/reports',
    ]);
  });

  it('the "my stuff" rows on Me', () => {
    expect(ME_LINKS.map((row) => row.href)).toEqual([
      '/rewards?view=mine',
      '/reports?view=mine',
      '/book?view=mine',
      '/community?tab=share&view=mine',
      '/me/points',
    ]);
  });
});
