'use client';

import dynamic from 'next/dynamic';
import { startTransition, useActionState, useState } from 'react';
import { addPin, removePin, type DashboardResult } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import {
  ALERT_ICON,
  ALERT_TYPES,
  DEFAULT_SEVERITY,
  OFFICIAL_TYPES,
  SEVERITIES,
  SEVERITY_DOT,
  type AlertType,
  type Severity,
} from '@/lib/domain/alerts';
import type { LatLng } from '@/lib/domain/geo';
import { useT } from '@/lib/i18n';

const LocationPicker = dynamic(() => import('@/components/app/LocationPicker').then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-chip motion-reduce:animate-none" />,
});

/** The office's own types first: they are what it pins most. */
const TYPES: readonly AlertType[] = [...OFFICIAL_TYPES, ...ALERT_TYPES];

/** "New official pin": what, how serious, a note, and where (the map moves under the pin). Empties after each pin. */
export function PinForm({ centre }: { centre: LatLng }) {
  const t = useT();
  const [round, setRound] = useState(0);
  const [added, setAdded] = useState(false);
  return (
    <div className="grid gap-2">
      <PinFields
        key={round}
        centre={centre}
        onAdded={() => {
          setAdded(true);
          setRound((n) => n + 1);
        }}
        onEdit={() => setAdded(false)}
      />
      <div role="status">{added && <p className="text-sm font-bold text-green-text">{t('dashboard.pins.added')}</p>}</div>
    </div>
  );
}

function PinFields({ centre, onAdded, onEdit }: { centre: LatLng; onAdded: () => void; onEdit: () => void }) {
  const t = useT();
  const [type, setType] = useState<AlertType>(TYPES[0]);
  const [severity, setSeverity] = useState<Severity>(DEFAULT_SEVERITY[TYPES[0]]);
  const [at, setAt] = useState<LatLng | null>(null);
  const [result, pin, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      const done = await addPin(formData);
      if (done?.ok) onAdded();
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);
  const spot = at ?? centre;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => pin(new FormData(event.currentTarget)));
      }}
      onChange={onEdit}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('dashboard.pins.type')}>
          {(control) => (
            <select
              {...control}
              name="type"
              value={type}
              onChange={(event) => {
                const next = event.target.value as AlertType;
                setType(next);
                setSeverity(DEFAULT_SEVERITY[next]); // each type comes with its own level; the office can change it
              }}
            >
              {TYPES.map((option) => (
                <option key={option} value={option}>
                  {ALERT_ICON[option]} {t(`alert.type.${option}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('map.drop.severity')}>
          {(control) => (
            <select {...control} name="severity" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>
              {SEVERITIES.map((level) => (
                <option key={level} value={level}>
                  {SEVERITY_DOT[level]} {t(`severity.${level}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label={t('dashboard.pins.note')} hint={t('dashboard.pins.noteHint')}>
        {(control) => <textarea {...control} name="note" rows={2} maxLength={280} />}
      </Field>
      <div className="grid gap-2">
        <p className="text-sm font-bold">{t('dashboard.pins.where')}</p>
        <LocationPicker value={spot} onChange={setAt} centre={centre} />
        <input type="hidden" name="lat" value={spot.lat} />
        <input type="hidden" name="lng" value={spot.lng} />
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button type="submit" variant="ink" disabled={pending} className="justify-self-start">
        {t('dashboard.pins.add')}
      </Button>
    </form>
  );
}

/** "Remove" next to an official pin on the list. */
export function RemovePinButton({ id, label }: { id: string; label: string }) {
  const t = useT();
  // `action={remove}` is fine: the form holds only the pin's id.
  const [result, remove, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      return await removePin(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);
  return (
    <form action={remove} className="grid justify-items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button variant="outline" disabled={pending} aria-label={label}>
        {t('dashboard.pins.remove')}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
