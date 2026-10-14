'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import {
  ALERT_ICON,
  ALERT_TYPES,
  DEFAULT_FILTERS,
  DISTANCE_OPTIONS,
  SEVERITIES,
  SEVERITY_DOT,
  parseFilters,
  type AlertFilters,
} from '@/lib/domain/alerts';
import { formatDistance } from '@/lib/domain/geo';
import { useT } from '@/lib/i18n';

const KEY = 'serumpun.mapFilters';
// This page's copy of the saved filters. Storage can be missing or blocked (private mode, cleared site data): the
// filters then still work, and are forgotten when the page closes.
let saved: string | null | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function savedFilters() {
  if (saved === undefined) {
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
  }
  return saved;
}

function saveFilters(next: AlertFilters) {
  saved = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, saved);
  } catch {
    // Not remembered after this page; see `saved`.
  }
  listeners.forEach((listener) => listener());
}

/** The map's filters, remembered on this phone. The server (and hydration) render the defaults, then the saved ones. */
export function useMapFilters() {
  const raw = useSyncExternalStore(subscribe, savedFilters, () => null);
  const filters = useMemo(() => parseFilters(raw), [raw]);
  return [filters, saveFilters] as const;
}

// Keeps the canonical order, so the saved lists and the chips' counts stay stable.
const toggle = <T extends string>(all: readonly T[], on: readonly T[], item: T) =>
  on.includes(item) ? on.filter((x) => x !== item) : all.filter((x) => x === item || on.includes(x));

// Checkboxes stay real (and keyboard-operable) under the look: the label carries the state and the focus ring, and a ✓
// shows the choice without relying on colour.
const choice =
  'relative cursor-pointer border-2 border-line has-checked:border-red has-checked:bg-tint-red has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text';
const legend = 'mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-2';

/** Distance, severity and type (canvas "Filters"). Changes apply at once; the button shows how many alerts are left. */
export function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  count,
  hasLocation,
}: {
  open: boolean;
  onClose: () => void;
  filters: AlertFilters;
  onChange: (next: AlertFilters) => void;
  /** Alerts on the map with these filters. */
  count: number;
  /** Without a location the distance choice is kept but cannot apply. */
  hasLocation: boolean;
}) {
  const t = useT();
  const distance = (d: number | null) => (d === null ? 'all' : String(d));
  return (
    <Sheet open={open} onClose={onClose} title={t('map.filter.title')}>
      <div className="grid gap-5 pb-2">
        <div>
          <p className={legend}>{t('map.filter.distance')}</p>
          <Segmented
            label={t('map.filter.distance')}
            value={distance(filters.maxDistanceM)}
            onChange={(value) => onChange({ ...filters, maxDistanceM: value === 'all' ? null : Number(value) })}
            options={DISTANCE_OPTIONS.map((d) => ({
              value: distance(d),
              label: d === null ? t('map.filter.anyDistance') : formatDistance(d),
            }))}
          />
          {!hasLocation && <p className="mt-2 text-xs text-muted-2">{t('map.filter.noLocation')}</p>}
        </div>

        <fieldset className="min-w-0">
          <legend className={legend}>{t('map.filter.severity')}</legend>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((level) => (
              <label key={level} className={`${choice} inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold`}>
                <input
                  type="checkbox"
                  checked={filters.severities.includes(level)}
                  onChange={() => onChange({ ...filters, severities: toggle(SEVERITIES, filters.severities, level) })}
                  className="peer sr-only"
                />
                <span aria-hidden="true">{SEVERITY_DOT[level]}</span>
                {t(`severity.${level}`)}
                <span aria-hidden="true" className="hidden text-red-text peer-checked:inline">
                  ✓
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className={legend}>{t('map.filter.type')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {ALERT_TYPES.map((type) => (
              <label
                key={type}
                className={`${choice} flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center`}
              >
                <input
                  type="checkbox"
                  checked={filters.types.includes(type)}
                  onChange={() => onChange({ ...filters, types: toggle(ALERT_TYPES, filters.types, type) })}
                  className="peer sr-only"
                />
                <span aria-hidden="true" className="absolute right-1.5 top-1 hidden text-xs font-extrabold text-red-text peer-checked:block">
                  ✓
                </span>
                <span aria-hidden="true" className="text-xl leading-none">
                  {ALERT_ICON[type]}
                </span>
                <span className="text-xs font-bold leading-tight">{t(`alert.type.${type}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onChange(DEFAULT_FILTERS)}>
            {t('map.filter.reset')}
          </Button>
          <Button type="button" variant="ink" onClick={onClose} className="flex-1">
            {count === 0 ? t('map.filter.showNone') : count === 1 ? t('map.filter.showOne') : t('map.filter.show', { n: count })}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
