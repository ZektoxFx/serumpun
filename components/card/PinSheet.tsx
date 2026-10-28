'use client';

import { Sheet } from '@/components/ui/Sheet';
import type { PinAnswer } from '@/lib/card/pin';
import { PinPad } from './PinPad';

/**
 * The PIN pad in a sheet, for anything the 6-digit PIN confirms: opening the card, moving it, approving a lost phone.
 * `check` sends the PIN; the right one calls `onDone`, and the parent closes the sheet. `cardId` and `demoPin` go together,
 * as on the pad.
 */
export function PinSheet({
  open,
  onClose,
  title,
  cardId,
  demoPin,
  check,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  cardId: string;
  demoPin: string | null;
  check: (pin: string) => Promise<PinAnswer>;
  onDone: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <PinPad cardId={cardId} demoPin={demoPin} check={check} onUnlock={onDone} />
    </Sheet>
  );
}
