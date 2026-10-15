import { internalPath, returnPath, unreadBadge } from '@/lib/domain/notifications';

describe('returnPath', () => {
  it('sends a resident back to the page that asked them to sign in, query string and all', () => {
    expect(returnPath('/checkin/3f0c9a52-1b7e-4c1d-9a3e-2b8f6d4e1a90?c=abc123')).toBe('/checkin/3f0c9a52-1b7e-4c1d-9a3e-2b8f6d4e1a90?c=abc123');
    expect(returnPath('/reports/42')).toBe('/reports/42');
  });

  it('ignores the landing page itself (it would loop), and anything that could leave the app', () => {
    for (const next of ['/', '/?next=/home', '//evil.example', 'https://evil.example', '', null, undefined, ['/home']]) {
      expect(returnPath(next), String(next)).toBeNull();
    }
  });
});

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
