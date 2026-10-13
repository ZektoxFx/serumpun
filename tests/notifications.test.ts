import { internalPath, unreadBadge } from '@/lib/domain/notifications';

describe('internalPath', () => {
  it('keeps paths inside the app, query strings included', () => {
    expect(internalPath('/')).toBe('/');
    expect(internalPath('/reports/42')).toBe('/reports/42');
    expect(internalPath('/community?tab=share&view=mine')).toBe('/community?tab=share&view=mine');
  });

  // redirect() follows absolute URLs too, so this is what keeps a notification from sending a resident off-site.
  it('refuses anything that could leave the app', () => {
    for (const link of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'reports/1', '']) {
      expect(internalPath(link), link).toBeNull();
    }
  });

  it('refuses a link that is missing or not text', () => {
    for (const link of [null, undefined, 42, {}]) expect(internalPath(link)).toBeNull();
  });

  it('refuses control characters, which could split a redirect header', () => {
    expect(internalPath('/ok\r\nSet-Cookie: a=1')).toBeNull();
    expect(internalPath('/ok\u0000')).toBeNull();
  });
});

describe('unreadBadge', () => {
  it('shows nothing for none, the count up to 9, then 9+', () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(1)).toBe('1');
    expect(unreadBadge(9)).toBe('9');
    expect(unreadBadge(10)).toBe('9+');
    expect(unreadBadge(250)).toBe('9+');
  });
});
