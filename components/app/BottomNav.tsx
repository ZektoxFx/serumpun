'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { raiseEmergency } from '@/app/(app)/emergency/actions';
import { ARMED_MS, HOLD_MS } from '@/lib/domain/emergency';
import { resolveStartLocation, type LatLng } from '@/lib/domain/geo';
import { TABS, isActiveTab } from '@/lib/domain/nav';
import { useT } from '@/lib/i18n';
import { CreateSheet } from './CreateSheet';
import { EmergencySheet, type EmergencyState } from './EmergencySheet';

/** Where the sender is: the phone's location when it is in the township, else their neighbourhood (`fallback`). */
function here(fallback: LatLng): Promise<LatLng> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(fallback);
    // The timeout below does not count a permission prompt, so an unanswered "Allow location?" cannot hold the alert.
    setTimeout(() => resolve(fallback), 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(resolveStartLocation({ lat: p.coords.latitude, lng: p.coords.longitude }, fallback)),
      () => resolve(fallback),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  });
}

// Stroke icons, so the active tab turns its icon red along with its label (an emoji cannot be recoloured).
const icons: Record<(typeof TABS)[number]['key'], ReactNode> = {
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  map: (
    <>
      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z" />
      <path d="M8 2v16M16 6v16" />
    </>
  ),
  community: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  me: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

/**
 * Home · Map · ＋ · Community · Me, fixed to the bottom of every resident page. A tap on + opens the Create sheet. Held
 * for 3 seconds it turns into a red "!" (feedback, 17 Oct), and one more tap sends an emergency alert from where the
 * resident is; the Create sheet arms it too, for those who cannot hold.
 */
export function BottomNav({ fallback }: { fallback: LatLng }) {
  const t = useT();
  const pathname = usePathname();
  const view = useSearchParams().get('view');
  const [creating, setCreating] = useState(false);
  const [holding, setHolding] = useState(false);
  const [armed, setArmed] = useState(false);
  const [alert, setAlert] = useState<EmergencyState | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The click that ends a completed hold must not also send: only the next tap does.
  const swallowClick = useRef(false);
  const fab = useRef<HTMLButtonElement>(null);

  function arm(byHolding: boolean) {
    swallowClick.current = byHolding;
    setArmed(true);
    navigator.vibrate?.(200);
    clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), ARMED_MS);
  }
  function stopHold() {
    clearTimeout(holdTimer.current);
    setHolding(false);
  }
  async function send() {
    clearTimeout(armTimer.current);
    setArmed(false);
    setAlert({ phase: 'sending' });
    try {
      const done = await raiseEmergency(await here(fallback));
      setAlert(done.ok ? { phase: 'sent', id: done.id } : { phase: 'failed', error: done.error });
    } catch {
      setAlert({ phase: 'failed', error: 'common.error' });
    }
  }
  // A conversation puts its composer where the bar would be, and Book a Court its Book bar (canvas); My bookings
  // (/book?view=mine) keeps it. Full-screen flows may hide it: Task 4 ruling.
  if (/^\/messages\/[^/]+$/.test(pathname) || (pathname === '/book' && view !== 'mine')) return null;
  return (
    <>
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {TABS.map((tab, index) => {
            const active = isActiveTab(pathname, tab.href);
            return (
              <Fragment key={tab.key}>
                {/* The Create button takes the middle cell, between Map and Community. */}
                {index === 2 && (
                  <div className="relative -mt-8 justify-self-center">
                    {armed && (
                      <span aria-hidden="true" className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red px-2.5 py-1 text-xs font-extrabold text-white">
                        {t('emergency.tapToSend')}
                      </span>
                    )}
                    <button
                      ref={fab}
                      type="button"
                      aria-label={armed ? t('emergency.armed') : t('nav.create')}
                      aria-haspopup="dialog"
                      onPointerDown={() => {
                        swallowClick.current = false; // a new press: a hold that ended off the button left nothing to swallow
                        if (armed) return;
                        setHolding(true);
                        holdTimer.current = setTimeout(() => {
                          setHolding(false);
                          arm(true);
                        }, HOLD_MS);
                      }}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
                      onContextMenu={(event) => event.preventDefault()}
                      onClick={() => {
                        if (swallowClick.current) swallowClick.current = false;
                        else if (armed) void send();
                        else setCreating(true);
                      }}
                      className={`grid size-15 touch-manipulation select-none place-items-center rounded-full text-white shadow-fab transition-transform duration-150 [-webkit-touch-callout:none] active:scale-95 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:active:scale-100 ${
                        armed ? 'animate-armed bg-red' : holding ? 'animate-hold bg-brand-gradient' : 'bg-brand-gradient'
                      }`}
                    >
                      {armed ? (
                        <span aria-hidden="true" className="text-4xl font-extrabold leading-none">
                          !
                        </span>
                      ) : (
                        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  // Inset focus ring: the outer tabs touch the screen edge on a phone, which would clip the global one.
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-offset-[-2px] ${active ? 'font-bold text-red-text' : 'font-semibold text-muted'}`}
                >
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {icons[tab.key]}
                  </svg>
                  {t(tab.label)}
                </Link>
              </Fragment>
            );
          })}
        </div>
      </nav>
      <CreateSheet
        open={creating}
        onClose={() => setCreating(false)}
        onEmergency={() => {
          setCreating(false);
          arm(false);
          fab.current?.focus();
        }}
      />
      <EmergencySheet state={alert} onClose={() => setAlert(null)} />
    </>
  );
}
