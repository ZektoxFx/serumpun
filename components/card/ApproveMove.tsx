'use client';

import { useId, useState } from 'react';
import { approveMove } from '@/app/(app)/me/household/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';
import { PinSheet } from './PinSheet';

/**
 * "Approve" for a person whose new phone waits for their card, when their old phone is lost: the approver's own PIN moves the
 * card and stops the old phone at once. The page shows it only to a manager who may (canApproveMove), and approve_phone_move
 * decides again. The action refreshes the page after every answer, so a phone that no longer waits leaves with its button.
 */
export function ApproveMove({ member, name, cardId, demoPin }: { member: string; name: string; cardId: string; demoPin: string | null }) {
  const t = useT();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" aria-haspopup="dialog" aria-describedby={hintId} onClick={() => setOpen(true)}>
        {t('household.move.approve')}
        <span className="sr-only"> {name}</span>
      </Button>
      <p id={hintId} className="text-sm text-muted-2">
        {t('household.move.approveHint')}
      </p>
      <PinSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('household.move.approveTitle', { name })}
        cardId={cardId}
        demoPin={demoPin}
        check={(pin) => approveMove(member, pin)}
        onDone={() => setOpen(false)}
      />
    </div>
  );
}
