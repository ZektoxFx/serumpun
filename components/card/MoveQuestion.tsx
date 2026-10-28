'use client';

import { useId, useState, useTransition } from 'react';
import { declineMove, moveCard } from '@/app/(app)/me/card/actions';
import { Button } from '@/components/ui/Button';
import { presentTap, type Device } from '@/lib/card/device';
import { useT, type MessageKey } from '@/lib/i18n';
import { PinSheet } from './PinSheet';

/**
 * Asked on the phone that holds the card, when a new phone waits for it. Yes asks for the PIN and moves the card, and
 * `onMoved` says it is done; No turns the new phone away, and the action refreshes the page, so the question goes with it.
 * `device` is the browser's own keys and its pass, which sign the note that proves to the server that this is the phone.
 */
export function MoveQuestion({ cardId, device, onMoved }: { cardId: string; device: Pick<Device, 'keys' | 'pass'>; onMoved: () => void }) {
  const t = useT();
  const headingId = useId();
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);

  return (
    <section aria-labelledby={headingId} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <h2 id={headingId} className="text-base font-extrabold">
        {t('card.move.question')}
      </h2>
      <div className="grid gap-2">
        <Button type="button" aria-haspopup="dialog" onClick={() => setPinOpen(true)}>
          {t('card.move.yes')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                setError((await declineMove()).error ?? null);
              } catch {
                setError('common.error');
              }
            })
          }
        >
          {t('card.move.no')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(error)}
        </p>
      )}
      <PinSheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        title={t('card.pin.title')}
        cardId={cardId}
        // A demo account never has a new phone waiting (it skips waiting), so there is no demo PIN to show here.
        demoPin={null}
        // A fresh note signed with this browser's key: it proves to the server that the phone being moved is this one.
        check={async (pin) => moveCard(await presentTap(device, { place: null, facility: null }, Date.now()), pin)}
        onDone={() => {
          setPinOpen(false);
          onMoved();
        }}
      />
    </section>
  );
}
