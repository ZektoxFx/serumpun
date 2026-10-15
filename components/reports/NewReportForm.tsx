'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useId, useState } from 'react';
import { createReport, type ReportActionResult } from '@/app/(app)/reports/actions';
import { PhotoInput, uploadPhoto } from '@/components/app/PhotoInput';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { distanceMeters, formatDistance, resolveStartLocation, type LatLng } from '@/lib/domain/geo';
import { nearestPlace } from '@/lib/domain/places';
import {
  CATEGORY_ICON,
  PUBLIC_REPORT_COLUMNS,
  REPORT_CATEGORIES,
  canMeToo,
  type PublicReport,
  type ReportCategory,
} from '@/lib/domain/reports';
import { useT } from '@/lib/i18n';
import { createBrowserClient } from '@/lib/supabase/client';
import { MeTooButton } from './MeTooButton';

const LocationPicker = dynamic(() => import('@/components/app/LocationPicker').then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-chip motion-reduce:animate-none" />,
});

/** Waits this long after the last pin move before asking for reports nearby. */
const NEARBY_DEBOUNCE_MS = 400;

/**
 * "Report to Management Office" (canvas "Reporting channel → 1 · New report"): what, where, then "Already reported
 * nearby?" with Me too, then an optional photo, description and "Keep private". The place is the phone's GPS fix, the
 * map alert the report comes from, or the pin. Pending residents see the form with the reason instead of Send.
 */
export function NewReportForm({
  centre,
  canPost,
  userId,
  prefill,
}: {
  centre: LatLng;
  canPost: boolean;
  userId: string;
  /** From a map alert's "Send to Management Office" (parsePrefill). */
  prefill: { category: ReportCategory | null; at: LatLng | null; alertId: string | null };
}) {
  const t = useT();
  const router = useRouter();
  const dupHeading = useId();
  const [category, setCategory] = useState(prefill.category);
  const [fix, setFix] = useState<LatLng | null>(null);
  // Until the resident moves the pin it follows the alert's place or the GPS fix.
  const [chosen, setChosen] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [nearby, setNearby] = useState<PublicReport[]>([]);
  const [nearbyVersion, setNearbyVersion] = useState(0);

  // A linked place far from the township (or a crafted link) does not count, like a far GPS fix.
  const linked = prefill.at && resolveStartLocation(prefill.at, centre) === prefill.at ? prefill.at : null;
  const hasLink = linked !== null;
  useEffect(() => {
    if (hasLink || !navigator.geolocation) return; // the alert already says where
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setFix({ lat: coords.latitude, lng: coords.longitude }),
      () => {}, // denied or no fix: the pin asks instead
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
  }, [hasLink]);

  const me = fix && resolveStartLocation(fix, centre) === fix ? fix : null; // a visitor in KL is not "here"
  const known = chosen ?? linked ?? me;
  const pin = known ?? centre;
  const showPicker = picking || known === null;
  const atDevice = chosen === null && linked === null && me !== null; // the pin is still on the phone's own fix
  const place = nearestPlace(pin);

  // "Already reported nearby?": the open public reports of this category within 150 m of the pin.
  const { lat, lng } = pin;
  useEffect(() => {
    if (!category) return;
    let stale = false;
    const id = setTimeout(async () => {
      const { data, error } = await createBrowserClient()
        .rpc('nearby_open_reports', { p_category: category, p_lat: lat, p_lng: lng })
        .select(PUBLIC_REPORT_COLUMNS);
      if (error) console.error(`nearby reports were not checked: ${error.message}`); // the form still works
      else if (!stale) setNearby(data as PublicReport[]); // a set of public_reports rows (no generated schema types here)
    }, NEARBY_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [category, lat, lng, nearbyVersion]);
  const matches = nearby.filter((r) => r.category === category); // until a new category's answer arrives

  const [result, send, pending] = useActionState(async (_: ReportActionResult, formData: FormData): Promise<ReportActionResult> => {
    try {
      if (photo) formData.set('photo', await uploadPhoto(photo, formData.get('private') === 'on' ? userId : undefined));
    } catch {
      return { ok: false, error: 'photo.error.upload' }; // the form keeps everything, the photo included
    }
    try {
      const done = await createReport(formData);
      if (done?.ok) router.push(`/reports/${done.id}`);
      return done;
    } catch {
      return { ok: false, error: 'common.error' }; // the request itself failed (offline)
    }
  }, null);

  const categoryLabel = category ? t(`report.category.${category}`) : '';
  const placeLabel = place ? t(place.label) : '';
  const label = 'text-sm font-bold text-text';

  return (
    <div className="grid gap-5">
      {!canPost && (
        <p className="rounded-xl bg-tint-amber px-3 py-2.5 text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>
      )}

      <fieldset className="min-w-0">
        <legend className={`${label} mb-2`}>{t('report.new.what')}</legend>
        <div className="grid grid-cols-4 gap-2">
          {REPORT_CATEGORIES.map((option) => (
            <label
              key={option}
              className="relative flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-line bg-surface px-1 py-2 text-center has-checked:border-red has-checked:bg-tint-red has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text"
            >
              {/* Outside the form (the Me too buttons below are forms of their own); the form sends a hidden copy. */}
              <input
                type="radio"
                name="category-pick"
                value={option}
                checked={category === option}
                onChange={() => setCategory(option)}
                className="peer sr-only"
              />
              <span aria-hidden="true" className="absolute right-1.5 top-1 hidden text-xs font-extrabold text-red-text peer-checked:block">
                ✓
              </span>
              <span aria-hidden="true" className="text-2xl leading-none">
                {CATEGORY_ICON[option]}
              </span>
              <span className="text-xs font-bold leading-tight break-words">{t(`report.category.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <p className={label}>{t('report.new.where')}</p>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-xl">
            📍
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-bold">{t(atDevice ? 'map.drop.atYou' : 'map.drop.atPin')}</span>
            {place && <span className="block text-muted-2">{t('map.alert.near', { place: placeLabel })}</span>}
          </p>
          {known !== null && (
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
        {/* Neighbours see a public report's place, and a resident at home would be marking their own house. */}
        {atDevice && <p className="text-xs text-muted-2">{t('map.drop.privacy')}</p>}
        {showPicker && (
          <>
            <p className="text-xs text-muted-2">{t(known ? 'map.drop.pinHint' : 'map.drop.noGps')}</p>
            <LocationPicker value={pin} onChange={setChosen} centre={centre} />
          </>
        )}
      </div>

      {matches.length > 0 && (
        <section aria-labelledby={dupHeading} className="grid gap-2 rounded-2xl border border-amber bg-tint-amber p-3">
          <h2 id={dupHeading} className="text-sm font-extrabold text-amber-text">
            <span aria-hidden="true">⚠</span> {t('report.new.dupTitle')}
          </h2>
          <ul className="grid gap-2">
            {matches.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/reports/${r.id}`} className="block break-words text-sm font-extrabold underline-offset-2 hover:underline">
                    <span aria-hidden="true">{CATEGORY_ICON[r.category]}</span> {r.title}
                  </Link>
                  <p className="text-xs text-muted-2">
                    {t('report.new.dupMeta', {
                      distance: formatDistance(distanceMeters(pin, r)),
                      status: t(`report.status.${r.status}`),
                      n: r.metoo_count,
                    })}
                  </p>
                </div>
                {canPost && canMeToo(r) && (
                  <MeTooButton
                    reportId={r.id}
                    done={r.has_metoo}
                    onDone={async () => setNearbyVersion((v) => v + 1)}
                    className="w-28 shrink-0"
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="text-center text-xs font-bold text-amber-text">{t('report.new.dupDifferent')}</p>
        </section>
      )}

      <form
        // Not `action={send}`: React resets a form after every action, which would wipe the description when a send fails.
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => send(new FormData(event.currentTarget)));
        }}
        className="grid gap-4"
      >
        <input type="hidden" name="category" value={category ?? ''} />
        <input type="hidden" name="title" value={place ? t('report.autoTitle', { category: categoryLabel, place: placeLabel }) : categoryLabel} />
        <input type="hidden" name="location" value={placeLabel} />
        <input type="hidden" name="lat" value={pin.lat} />
        <input type="hidden" name="lng" value={pin.lng} />
        <input type="hidden" name="alert" value={prefill.alertId ?? ''} />

        <PhotoInput onChange={setPhoto} disabled={!canPost} />

        <Field label={t('report.new.describe')} hint={t('report.new.describeHint')}>
          {(control) => <textarea {...control} name="description" rows={3} maxLength={1000} disabled={!canPost} />}
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text">
          <input type="checkbox" name="private" disabled={!canPost} className="mt-0.5 size-5 shrink-0 accent-red" />
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              <span aria-hidden="true">🔒</span> {t('report.new.private')}
            </span>
            <span className="block text-xs text-muted-2">{t('report.new.privateHint')}</span>
          </span>
        </label>

        {result && !result.ok && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {t(result.error)}
          </p>
        )}
        <Button
          type="submit"
          variant="gradient"
          size="xl"
          // Stays off after success too, while the page moves to the new report: a second tap would send it twice.
          disabled={!canPost || category === null || pending || result?.ok === true}
          className="w-full focus-visible:outline-[#001C3C]"
        >
          {t('report.new.send')}
        </Button>
        <p className="text-xs text-muted-2">{t('report.new.fine')}</p>
      </form>
    </div>
  );
}
