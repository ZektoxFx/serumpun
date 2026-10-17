'use client';

import { useEffect, useState } from 'react';
import { forgetPushSubscription, savePushSubscription } from '@/app/(app)/emergency/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

type State = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// The browser wants the server's public key as bytes; it is stored as URL-safe base64.
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Me › Emergency alerts on this phone: turns phone notifications on (the browser asks first) so an emergency within
 * 2 km shows even on the lock screen, or off. iPhones only allow it once Serumpun is on the Home Screen.
 */
export function PushAlerts() {
  const t = useT();
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('blocked');
      const registration = await navigator.serviceWorker.getRegistration('/');
      setState((await registration?.pushManager.getSubscription()) ? 'on' : 'off');
    })();
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState(permission === 'denied' ? 'blocked' : 'off');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) });
      const keys = sub.toJSON().keys ?? {};
      const saved = await savePushSubscription({ endpoint: sub.endpoint, p256dh: keys.p256dh ?? '', auth: keys.auth ?? '' });
      setState(saved ? 'on' : 'off');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
      if (sub) {
        await forgetPushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-2">
        {state === 'unsupported' ? t('alerts.unsupported') : state === 'blocked' ? t('alerts.blocked') : t('alerts.hint')}
      </p>
      {state === 'off' && (
        <Button type="button" variant="ink" disabled={busy} onClick={() => void turnOn()} className="justify-self-start">
          <span aria-hidden="true">🔔</span> {t('alerts.turnOn')}
        </Button>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-extrabold text-green-text">✓ {t('alerts.on')}</span>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void turnOff()}>
            {t('alerts.turnOff')}
          </Button>
        </div>
      )}
    </div>
  );
}
