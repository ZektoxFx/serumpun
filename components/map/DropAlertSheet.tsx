'use client';

import dynamic from 'next/dynamic';
import { useActionState, useState } from 'react';
import { dropAlert, type MapActionResult } from '@/app/(app)/map/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { ALERT_ICON, ALERT_TYPES, DEFAULT_SEVERITY, SEVERITIES, SEVERITY_DOT, type AlertType, type Severity } from '@/lib/domain/alerts';
import type { LatLng } from '@/lib/domain/geo';
import { nearestPlace } from '@/lib/domain/places';
import { useT } from '@/lib/i18n';

const LocationPicker = dynamic(() => import('@/components/app/LocationPicker').then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-chip" />,
});

/** "Drop an alert in 2 taps": pick a type, then Post. Where comes from GPS, or from the pin when there is no fix. */
export function DropAlertSheet({
  open,
  onClose,
  start,
  gps,
  centre,
  canPost,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  /** Where the pin starts: the resident's GPS fix, else the middle of the map they are looking at. */
  start: LatLng;
  /** Whether `start` is the GPS fix. */
  gps: boolean;
  centre: LatLng;
  /** Pending residents see the form, with the reason in place of a working Post button. */
  canPost: boolean;
  onPosted: (at: LatLng) => Promise<void>;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('create.alert')}>
      {/* Mounted only while open, so every drop starts from a clean form. */}
      <DropForm start={start} gps={gps} centre={centre} canPost={canPost} onPosted={onPosted} />
    </Sheet>
  );
}

function DropForm({
  start,
  gps,
  centre,
  canPost,
  onPosted,
}: {
  start: LatLng;
  gps: boolean;
  centre: LatLng;
  canPost: boolean;
  onPosted: (at: LatLng) => Promise<void>;
}) {
  const t = useT();
  const [type, setType] = useState<AlertType | null>(null);
  const [severity, setSeverity] = useState<Severity>('medium');
  // Until the resident moves the pin it follows `start`, so a GPS fix that arrives late still wins.
  const [chosen, setChosen] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState(false);
  const [result, post, pending] = useActionState(async (_: MapActionResult, formData: FormData) => {
    const done = await dropAlert(formData);
    if (done?.ok) await onPosted({ lat: Number(formData.get('lat')), lng: Number(formData.get('lng')) });
    return done;
  }, null);

  const pin = chosen ?? start;
  const showPicker = picking || !gps;
  const place = nearestPlace(pin);
  const where = chosen === null && gps ? t('map.drop.atYou') : t('map.drop.atPin');
  const label = 'text-sm font-bold text-text';

  return (
    <form action={post} className="grid gap-4 pb-2">
      {!canPost && (
        <p className="rounded-xl bg-tint-amber px-3 py-2.5 text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>
      )}

      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-xl">
            📍
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-bold">{where}</span>
            {place && <span className="block text-muted-2">{t('map.alert.near', { place: t(place.label) })}</span>}
          </p>
          {gps && (
            <Button
              type="button"
              variant="outline"
              aria-expanded={showPicker}
              onClick={() => {
                if (!picking) setChosen(pin); // hold the pin still while it is being moved
                setPicking(!picking);
              }}
            >
              {t(picking ? 'map.drop.pinDone' : 'map.drop.movePin')}
            </Button>
          )}
        </div>
        {showPicker && (
          <>
            <p className="text-xs text-muted-2">{t(gps ? 'map.drop.pinHint' : 'map.drop.noGps')}</p>
            <LocationPicker value={pin} onChange={setChosen} centre={centre} />
          </>
        )}
        <input type="hidden" name="lat" value={pin.lat} />
        <input type="hidden" name="lng" value={pin.lng} />
      </div>

      <fieldset className="min-w-0">
        <legend className={`${label} mb-2`}>{t('map.drop.type')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {ALERT_TYPES.map((option) => (
            <label
              key={option}
              className="relative flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-line bg-surface px-1 py-2 text-center has-checked:border-red has-checked:bg-tint-red has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text"
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => {
                  setType(option);
                  setSeverity(DEFAULT_SEVERITY[option]); // each type comes with its own level; the poster can change it
                }}
                className="peer sr-only"
              />
              <span aria-hidden="true" className="absolute right-1.5 top-1 hidden text-xs font-extrabold text-red-text peer-checked:block">
                ✓
              </span>
              <span aria-hidden="true" className="text-2xl leading-none">
                {ALERT_ICON[option]}
              </span>
              <span className="text-xs font-bold leading-tight">{t(`alert.type.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {type && (
        <div className="grid gap-2">
          <p className={label}>{t('map.drop.severity')}</p>
          <Segmented
            label={t('map.drop.severity')}
            value={severity}
            onChange={setSeverity}
            options={SEVERITIES.map((level) => ({
              value: level,
              label: (
                <>
                  <span aria-hidden="true">{SEVERITY_DOT[level]}</span> {t(`severity.${level}`)}
                </>
              ),
            }))}
          />
          <input type="hidden" name="severity" value={severity} />
        </div>
      )}

      <Field label={t('map.drop.note')} hint={t('map.drop.noteHint')}>
        {(control) => <textarea {...control} name="note" rows={2} maxLength={280} />}
      </Field>

      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!canPost || type === null || pending} className="w-full">
        {t('map.drop.post')}
      </Button>
      <p className="text-xs text-muted-2">{t('map.drop.fine')}</p>
    </form>
  );
}
