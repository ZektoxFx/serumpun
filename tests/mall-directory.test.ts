import { ELMINA_SHOPS, PLAN, searchShops, shopPin } from '@/lib/domain/mallDirectory';

describe('Elmina Lakeside Mall directory', () => {
  it('has the 99 shops of the official directory, each with a unit and a unique name', () => {
    expect(ELMINA_SHOPS).toHaveLength(99);
    expect(new Set(ELMINA_SHOPS.map((s) => s.name)).size).toBe(99);
    expect(ELMINA_SHOPS.every((s) => s.units.length > 0)).toBe(true);
  });

  it('pins every shop inside the layout plan', () => {
    for (const shop of ELMINA_SHOPS) {
      const pin = shopPin(shop);
      expect(pin, shop.name).not.toBeNull();
      expect(pin![0]).toBeGreaterThan(0);
      expect(pin![0]).toBeLessThan(PLAN.width);
      expect(pin![1]).toBeGreaterThan(0);
      expect(pin![1]).toBeLessThan(PLAN.height);
    }
  });

  it('searches by name or unit, filters by category, A to Z, and finds nothing for nonsense', () => {
    expect(searchShops(ELMINA_SHOPS, 'jaya', 'all').map((s) => s.name)).toEqual(['Jaya Grocer']);
    expect(searchShops(ELMINA_SHOPS, 'gf-29', 'all').map((s) => s.name)).toEqual(['Jaya Grocer']);
    expect(searchShops(ELMINA_SHOPS, '', 'groceries').map((s) => s.name)).toContain('Jaya Grocer');
    expect(searchShops(ELMINA_SHOPS, 'zzz', 'all')).toEqual([]);
    const all = searchShops(ELMINA_SHOPS, '', 'all').map((s) => s.name);
    expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
  });
});
