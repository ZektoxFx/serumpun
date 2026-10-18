'use client';

import { Glyph } from '@/components/ui/Glyph';
import { Sheet } from '@/components/ui/Sheet';
import { formatDistance, type LatLng } from '@/lib/domain/geo';
import { useT } from '@/lib/i18n';
import type { Route } from '@/lib/route/findRoute';

/** Somewhere Safe Walk can go: a place, a court, or a spot tapped on the map. */
export type WalkPlace = LatLng & { label: string; icon: string };

/**
 * The top of the map during a Safe Walk (canvas "Live Map v2", phone 2): the route changed to avoid a confirmed hazard
 * and what it costs (navy, as on the canvas), or there is no safe way round (red). Nothing while the usual way is clear.
 */
export function SafeWalkBanner({ route, hazards, confirmed }: { route: Route; hazards: string; confirmed: string }) {
  const t = useT();
  if (route.avoided.length === 0) return null;
  const extra = route.minutes - route.normalMinutes;
  return (
    <p
      role="status"
      className={`pointer-events-auto rounded-xl px-3 py-2 text-sm font-semibold leading-snug text-white shadow-md ${route.blocked ? 'bg-red' : 'bg-[#001C3C]'}`}
    >
      {route.blocked
        ? `⚠ ${t('walk.blocked', { hazards })}`
        : `↪ ${extra > 0 ? t('walk.changed', { hazards, time: confirmed, n: extra }) : t('walk.changedSame', { hazards, time: confirmed })}`}
    </p>
  );
}

/**
 * Where Safe Walk goes (a sheet: the mall, the park, the courts, or a tap on the map) and, once walking, the card at
 * the bottom of the map: where to, how long and how far, the legend when the route goes round a hazard, and End.
 */
export function SafeWalkPanel({
  places,
  choosing,
  onClose,
  onChoose,
  onTapMap,
  walking,
  route,
  status,
  onEnd,
}: {
  places: WalkPlace[];
  /** The list of places is open. */
  choosing: boolean;
  onClose: () => void;
  onChoose: (place: WalkPlace) => void;
  onTapMap: () => void;
  walking: WalkPlace | null;
  route: Route | null;
  /** Before there is a route: the paths are loading, did not load, or do not reach there. */
  status: 'loading' | 'error' | 'none';
  onEnd: () => void;
}) {
  const t = useT();
  const rerouted = route !== null && route.avoided.length > 0 && !route.blocked;
  const row = 'flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 text-left font-bold hover:bg-soft';

  return (
    <>
      <Sheet open={choosing} onClose={onClose} title={t('walk.where')}>
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted-2">{t('walk.hint')}</p>
          <ul className="flex flex-col gap-2">
            {places.map((p) => (
              <li key={p.label}>
                <button type="button" onClick={() => onChoose(p)} className={row}>
                  <span aria-hidden="true" className="text-xl">
                    <Glyph emoji={p.icon} />
                  </span>
                  {p.label}
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={onTapMap} className={`${row} text-muted-2`}>
                <span aria-hidden="true" className="text-xl">
                  <Glyph emoji="📍" />
                </span>
                {t('walk.tapMap')}
              </button>
            </li>
          </ul>
        </div>
      </Sheet>

      {walking && (
        // Clear of the zoom buttons on the right, as the toast is.
        <section
          aria-label={t('walk.to', { place: walking.label })}
          className="absolute bottom-7 left-3 right-16 flex flex-col gap-1.5 rounded-2xl bg-surface p-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 break-words text-base font-extrabold leading-snug">
              <span aria-hidden="true"><Glyph emoji="🚶" /> </span>
              {t('walk.to', { place: walking.label })}
            </h2>
            <button type="button" onClick={onEnd} className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-bold text-red-text">
              {t('walk.end')}
            </button>
          </div>
          <p role="status" className="text-sm text-muted-2">
            {route
              ? t('walk.meta', { minutes: route.minutes, distance: formatDistance(route.distanceM) })
              : t(status === 'error' ? 'walk.loadError' : status === 'none' ? 'walk.noRoute' : 'walk.loading')}
          </p>
          {rerouted && (
            <p aria-hidden="true" className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-2">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-5 rounded-full bg-[#1E6FFF]" />
                {t('walk.legend.safe')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 border-t-2 border-dashed border-[#D51A21]" />
                {t('walk.legend.usual')}
              </span>
            </p>
          )}
        </section>
      )}
    </>
  );
}
