'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { saveFavourites } from '@/app/(app)/more/actions';
import { Button } from '@/components/ui/Button';
import { DEFAULT_FAVOURITES, MAX_FAVOURITES, SERVICES, moveItem, type Service, type ServiceKey } from '@/lib/domain/nav';
import { useT, type MessageKey } from '@/lib/i18n';

const face =
  'flex min-h-22 w-full flex-col items-center justify-center gap-1 rounded-xl border bg-surface px-0.5 py-2 text-center text-[0.6875rem] font-bold leading-tight shadow-card';
const badge = 'absolute -left-1 -top-1 z-10 grid size-6 place-items-center rounded-full text-sm font-extrabold leading-none';
// A press that travels this far is a drag, not a tap.
const DRAG_PX = 8;

const serviceOf = (key: ServiceKey) => SERVICES.find((s) => s.key === key) as Service;

/**
 * Edit favourites (like Touch 'n Go): − takes a favourite off, + adds one (up to 7), and a favourite moves by dragging
 * it over another, or, without dragging, by tapping it and using Move earlier / Move later. Save stores the order.
 */
export function FavouritesEditor({ initial }: { initial: ServiceKey[] }) {
  const t = useT();
  const router = useRouter();
  const [chosen, setChosen] = useState<ServiceKey[]>(initial);
  const [selected, setSelected] = useState<ServiceKey | null>(null);
  const [dragging, setDragging] = useState<ServiceKey | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saving, startSaving] = useTransition();
  const tiles = useRef(new Map<ServiceKey, HTMLElement>());
  const press = useRef<{ key: ServiceKey; x: number; y: number; moved: boolean } | null>(null);
  const full = chosen.length >= MAX_FAVOURITES;
  const others = SERVICES.filter((s) => !chosen.includes(s.key));
  const name = (key: ServiceKey) => t(serviceOf(key).label);

  function keyAt(x: number, y: number): ServiceKey | null {
    for (const [key, element] of tiles.current) {
      const r = element.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  }
  const move = (key: ServiceKey, by: number) =>
    setChosen((list) => moveItem(list, list.indexOf(key), list.indexOf(key) + by));

  function save() {
    setError(null);
    startSaving(async () => {
      const done = await saveFavourites(chosen).catch(() => ({ ok: false as const, error: 'common.error' as const }));
      if (done.ok) router.push('/home');
      else setError(done.error);
    });
  }

  return (
    <div className="grid gap-4">
      <section aria-labelledby="chosen-heading" className="grid gap-2">
        <h2 id="chosen-heading" className="px-1 text-base font-extrabold">
          {t('more.edit.count', { n: chosen.length })}
        </h2>
        {chosen.length === 0 ? (
          <p className="rounded-2xl bg-chip px-4 py-3 text-sm text-muted-2">{t('more.edit.empty')}</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {chosen.map((key) => {
              const service = serviceOf(key);
              const on = selected === key || dragging === key;
              return (
                <li
                  key={key}
                  ref={(element) => {
                    if (element) tiles.current.set(key, element);
                    else tiles.current.delete(key);
                  }}
                  className={`relative flex transition-transform duration-150 motion-reduce:transition-none ${dragging === key ? 'z-20 scale-110 -rotate-3' : ''}`}
                >
                  <button type="button" aria-label={t('more.edit.remove', { name: name(key) })} onClick={() => setChosen((list) => list.filter((k) => k !== key))} className={`${badge} bg-ink text-on-ink`}>
                    −
                  </button>
                  <button
                    type="button"
                    aria-pressed={selected === key}
                    // The tile moves under a finger, so the page must not scroll from it.
                    style={{ touchAction: 'none' }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      press.current = { key, x: event.clientX, y: event.clientY, moved: false };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const p = press.current;
                      if (!p || p.key !== key) return;
                      if (!p.moved && Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_PX) return;
                      if (!p.moved) {
                        p.moved = true;
                        setDragging(key);
                        setSelected(null);
                      }
                      const over = keyAt(event.clientX, event.clientY);
                      if (over && over !== key) setChosen((list) => moveItem(list, list.indexOf(key), list.indexOf(over)));
                    }}
                    onPointerUp={() => setDragging(null)}
                    onPointerCancel={() => {
                      press.current = null;
                      setDragging(null);
                    }}
                    onClick={() => {
                      const dragged = press.current?.moved;
                      press.current = null;
                      if (!dragged) setSelected((s) => (s === key ? null : key));
                    }}
                    className={`${face} select-none ${on ? 'border-red ring-2 ring-red' : 'border-line'}`}
                  >
                    <span aria-hidden="true" className="text-2xl leading-none">
                      {service.icon}
                    </span>
                    {t(service.label)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected && chosen.includes(selected) ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-chip px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-bold">{name(selected)}</span>
            <Button variant="outline" disabled={chosen.indexOf(selected) === 0} onClick={() => move(selected, -1)}>
              ← {t('more.edit.moveEarlier')}
            </Button>
            <Button variant="outline" disabled={chosen.indexOf(selected) === chosen.length - 1} onClick={() => move(selected, 1)}>
              {t('more.edit.moveLater')} →
            </Button>
          </div>
        ) : (
          <p className="px-1 text-sm text-muted-2">{t('more.edit.hint')}</p>
        )}
      </section>

      <section aria-labelledby="add-heading" className="grid gap-2">
        <h2 id="add-heading" className="px-1 text-base font-extrabold">
          {t('more.edit.add')}
        </h2>
        <ul className="grid grid-cols-4 gap-2">
          {others.map((service) => (
            <li key={service.key} className="relative flex">
              <button
                type="button"
                disabled={full}
                aria-label={t('more.edit.addOne', { name: t(service.label) })}
                onClick={() => setChosen((list) => (list.length < MAX_FAVOURITES ? [...list, service.key] : list))}
                className={`${face} border-line disabled:opacity-45`}
              >
                <span aria-hidden="true" className={`${badge} bg-tint-green text-green-text ring-1 ring-green-text`}>
                  +
                </span>
                <span aria-hidden="true" className="text-2xl leading-none">
                  {service.icon}
                </span>
                {t(service.label)}
              </button>
            </li>
          ))}
        </ul>
        {full && <p className="px-1 text-sm font-bold text-amber-text">{t('more.edit.full')}</p>}
      </section>

      {error && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(error)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setChosen([...DEFAULT_FAVOURITES]);
            setSelected(null);
          }}
        >
          {t('more.edit.reset')}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? t('more.edit.saving') : t('more.edit.save')}
        </Button>
      </div>
    </div>
  );
}
