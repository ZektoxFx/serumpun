'use client';

import { useState, useTransition } from 'react';
import { cancelInvite } from '@/app/(app)/me/household/actions';
import { Button } from '@/components/ui/Button';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * Cancel on an open invite. The action refreshes the page after every answer, so a cancelled invite leaves the list, and so
 * does one that was already gone (not_found) or that this person may not cancel (not_allowed): the row, or its Cancel,
 * takes this alert with it. Only `common.error` is ever seen here, because that invite is still on the page.
 */
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
