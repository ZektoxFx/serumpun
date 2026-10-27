'use client';

import { useState, useTransition } from 'react';
import { cancelInvite } from '@/app/(app)/me/household/actions';
import { Button } from '@/components/ui/Button';
import { useT, type MessageKey } from '@/lib/i18n';

/** Cancel on an open invite. The page behind it is refreshed by the action, so the invite leaves the list; a refusal is told here. */
export function CancelInvite({ invite, name }: { invite: string; name: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              setError((await cancelInvite(invite)).error ?? null);
            } catch {
              setError('common.error');
            }
          })
        }
      >
        {t('common.cancel')}
        <span className="sr-only"> {name}</span>
      </Button>
      {error && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(error)}
        </p>
      )}
    </div>
  );
}
