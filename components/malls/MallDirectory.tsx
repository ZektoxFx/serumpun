'use client';

import dynamic from 'next/dynamic';
import { useId, useRef, useState } from 'react';
import { ELMINA_SHOPS, FACILITIES, SHOP_CATEGORIES, searchShops, shopPin, type FacilityKind, type Point, type ShopCategory } from '@/lib/domain/mallDirectory';
import { useT } from '@/lib/i18n';

const MallPlan = dynamic(() => import('./MallPlan'), {
  ssr: false,
  loading: () => <div className="aspect-[3/2] w-full animate-pulse rounded-2xl bg-chip" />,
});

const chip = 'min-h-9 shrink-0 rounded-full border px-3 text-sm font-bold';

/** The mall directory: search and categories over the shops, the layout plan with a pin on the chosen shop, facilities. */
export function MallDirectory() {
  const t = useT();
  const id = useId();
  const plan = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShopCategory | 'all'>('all');
  const [chosen, setChosen] = useState<string | null>(null);
  const [facility, setFacility] = useState<FacilityKind | null>(null);
  const shops = searchShops(ELMINA_SHOPS, query, category);
  const shop = ELMINA_SHOPS.find((s) => s.name === chosen) ?? null;
  const spot = shop && shopPin(shop);
  const place = FACILITIES.find((f) => f.kind === facility);
  const pins: { point: Point; label: string }[] = spot
    ? [{ point: spot, label: shop.name }]
    : place
      ? place.points.map((point) => ({ point, label: place.icon })) // the chip names it; full labels on 4 toilets overlap
      : [];
  const focus = spot ?? place?.points[0] ?? null;
  const show = () => plan.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return (
    <div className="grid gap-3">
      <label htmlFor={id} className="sr-only">
        {t('mall.search')}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`🔎 ${t('mall.search')}`}
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-text placeholder:text-muted"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['all', ...SHOP_CATEGORIES] as const).map((c) => (
          <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`${chip} ${category === c ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface'}`}>
            {c === 'all' ? t('mall.all') : t(`mall.category.${c}`)}
          </button>
        ))}
      </div>

      <div ref={plan} className="grid scroll-mt-20 gap-1">
        <MallPlan pins={pins} focus={focus} />
        <p className="px-1 text-xs text-muted-2">{t('mall.planCredit')}</p>
      </div>

      <section aria-labelledby="facilities-heading" className="grid gap-2">
        <h2 id="facilities-heading" className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
          {t('mall.facilities')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {FACILITIES.map((f) => (
            <button
              key={f.kind}
              type="button"
              aria-pressed={facility === f.kind && !shop}
              onClick={() => {
                setChosen(null);
                setFacility(f.kind);
                show();
              }}
              className={`${chip} ${facility === f.kind && !shop ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface'}`}
            >
              <span aria-hidden="true">{f.icon} </span>
              {t(`mall.facility.${f.kind}`)}
            </button>
          ))}
        </div>
      </section>

      {shops.length === 0 ? (
        <p role="status" className="py-6 text-center text-muted-2">
          {t('mall.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {shops.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                aria-pressed={chosen === s.name}
                onClick={() => {
                  setChosen(s.name);
                  setFacility(null);
                  show();
                }}
                className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-soft focus-visible:outline-offset-[-2px] ${chosen === s.name ? 'bg-tint-red' : ''}`}
              >
                <span className="grid min-w-0 flex-1">
                  <span className="break-words font-bold">{s.name}</span>
                  <span className="text-sm text-muted-2">{t(`mall.category.${s.category}`)}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {s.units.map((u) => (
                    <span key={u} className="rounded-md bg-chip px-1.5 py-0.5 text-xs font-extrabold">
                      {u}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
