'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { EMERGENCY_ICON, PUBLIC_EMERGENCY_COLUMNS, withinAlertRadius, type PublicEmergency } from '@/lib/domain/emergency';
import { distanceMeters, formatDistance, type LatLng } from '@/lib/domain/geo';
import { useT } from '@/lib/i18n';
import { createBrowserClient } from '@/lib/supabase/client';

const SEEN = 'serumpun.emergencies.seen';
function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN, JSON.stringify([id, ...seen()].slice(0, 50)));
  } catch {
    // private mode: the popup may come back after a reload, which is fine for an emergency
  }
}

/**
 * The in-app alert (feedback, 17 Oct): a sheet over any page when an emergency starts within 2 km of the resident's
 * neighbourhood (`home`; null, as for the office, means every one), with what, how far, the map and Call 999. It
 * listens on the emergencies channel of the township, and checks once on every page load for one it has not shown.
 * `refresh` re-renders the page's server parts on each change (the dashboard's banner).
 */
export function EmergencyPopup({ townshipId, home, refresh = false }: { townshipId: string; home: LatLng | null; refresh?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [shown, setShown] = useState<PublicEmergency | null>(null);
  const shownId = useRef<string | null>(null);

  const check = useEffectEvent(async () => {
    if (refresh) router.refresh();
    const { data } = await createBrowserClient()
      .from('public_emergencies')
      .select(PUBLIC_EMERGENCY_COLUMNS)
      .order('created_at', { ascending: false })
      .overrideTypes<PublicEmergency[], { merge: false }>();
    const live = data ?? [];
    // The one on screen follows its changes (what it is) and goes away when it ends; else a new one near home.
    const next =
      live.find((e) => e.id === shownId.current) ??
      live.find((e) => !e.is_mine && !seen().includes(e.id) && withinAlertRadius(home, e)) ??
      null;
    shownId.current = next?.id ?? null;
    setShown(next);
  });

  useEffect(() => {
    const supabase = createBrowserClient();
    // Its own topic: the township's channel belongs to the page (one per page, see useTownshipEvents).
    const channel = supabase
      .channel(`emergencies:${townshipId}`)
      .on('broadcast', { event: 'emergencies' }, () => void check())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void check();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [townshipId]);

  function dismiss() {
    if (shown) markSeen(shown.id);
    shownId.current = null;
    setShown(null);
  }

  return (
    <Sheet open={shown !== null} onClose={dismiss} title={`🚨 ${t('emergency.popup.title')}`}>
      {shown && (
        <div className="flex flex-col gap-3 pb-2 pt-1" role="alert">
          <p className="text-xl font-extrabold text-red-text">
            <span aria-hidden="true">{EMERGENCY_ICON[shown.kind]} </span>
            {shown.kind === 'unknown' ? t('emergency.title') : t(`emergency.kind.${shown.kind}`)}
          </p>
          <p className="text-sm text-muted-2">
            {home && `${t('emergency.popup.from', { distance: formatDistance(distanceMeters(home, shown)) })} · `}
            <TimeAgo date={shown.created_at} />
          </p>
          <p className="font-semibold">{t('emergency.popup.safe')}</p>
          <a
            href="tel:999"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-red px-4 text-xl font-extrabold text-white hover:brightness-95"
          >
            <span aria-hidden="true">📞</span> {t('emergency.call')}
          </a>
          <Link
            href={`/map?emergency=${shown.id}`}
            onClick={dismiss}
            className="flex min-h-12 items-center justify-center rounded-xl border border-line-strong font-bold hover:bg-soft"
          >
            {t('emergency.showMap')}
          </Link>
          <button type="button" onClick={dismiss} className="min-h-11 rounded-xl text-sm font-bold text-muted-2">
            {t('emergency.popup.dismiss')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
