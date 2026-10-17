'use client';

import Link from 'next/link';
import { useState } from 'react';
import { closeEmergency, setEmergencyKind } from '@/app/(app)/emergency/actions';
import { Sheet } from '@/components/ui/Sheet';
import { EMERGENCY_ICON, EMERGENCY_KINDS, type EmergencyKind } from '@/lib/domain/emergency';
import { useT, type MessageKey } from '@/lib/i18n';

export type EmergencyState = { phase: 'sending' } | { phase: 'sent'; id: string } | { phase: 'failed'; error: MessageKey };

/**
 * After the armed ＋ is tapped: "Management and residents near you have been notified", Call 999 above everything
 * (always, even when sending failed), what is happening, the map, and Cancel for a false alarm.
 */
export function EmergencySheet({ state, onClose }: { state: EmergencyState | null; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={state !== null} onClose={onClose} title={`🚨 ${t('emergency.title')}`}>
      {state && <Sent state={state} onClose={onClose} />}
    </Sheet>
  );
}

function Sent({ state, onClose }: { state: EmergencyState; onClose: () => void }) {
  const t = useT();
  const [kind, setKind] = useState<EmergencyKind>('unknown');
  const [note, setNote] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const id = state.phase === 'sent' ? state.id : null;

  async function say(next: EmergencyKind) {
    if (!id) return;
    setKind(next);
    const done = await setEmergencyKind(id, next).catch(() => ({ ok: false as const, error: 'common.error' as const }));
    if (!done.ok) setNote(done.error);
  }
  async function cancel() {
    if (!id) return;
    setBusy(true);
    const done = await closeEmergency(id, 'cancelled').catch(() => ({ ok: false as const, error: 'common.error' as const }));
    setBusy(false);
    if (done.ok) onClose();
    else setNote(done.error);
  }

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      {state.phase === 'failed' ? (
        <p role="alert" className="rounded-xl bg-tint-red px-3 py-3 font-bold text-red-text">
          {t(state.error)}
        </p>
      ) : (
        <p role="status" className="rounded-xl bg-tint-red px-3 py-3 text-lg font-extrabold leading-snug text-red-text">
          {state.phase === 'sending' ? t('emergency.sending') : t('emergency.sent')}
        </p>
      )}
      <a
        href="tel:999"
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-red px-4 text-xl font-extrabold text-white hover:brightness-95"
      >
        <span aria-hidden="true">📞</span> {t('emergency.call')}
      </a>
      <p className="-mt-2 text-center text-sm text-muted-2">{t('emergency.callHint')}</p>
      {id && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">{t('emergency.what')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {EMERGENCY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => void say(k)}
                  className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-left text-sm font-bold ${
                    kind === k ? 'border-red bg-tint-red' : 'border-line bg-surface hover:bg-soft'
                  }`}
                >
                  <span aria-hidden="true" className="text-lg">
                    {EMERGENCY_ICON[k]}
                  </span>
                  {t(`emergency.kind.${k}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <Link
            href={`/map?emergency=${id}`}
            onClick={onClose}
            className="flex min-h-12 items-center justify-center rounded-xl border border-line-strong font-bold hover:bg-soft"
          >
            {t('emergency.showMap')}
          </Link>
          <button type="button" disabled={busy} onClick={() => void cancel()} className="min-h-11 rounded-xl text-sm font-bold text-muted-2 disabled:opacity-50">
            {t('emergency.cancel')}
          </button>
        </>
      )}
      {note && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(note)}
        </p>
      )}
    </div>
  );
}
