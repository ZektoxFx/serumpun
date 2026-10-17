'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { closeEmergency } from '@/app/(app)/emergency/actions';
import { useT, type MessageKey } from '@/lib/i18n';

/** "Resolve" on the dashboard's emergency banner: the red circle leaves every map. */
export function ResolveEmergency({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const done = await closeEmergency(id, 'resolved').catch(() => ({ ok: false as const, error: 'common.error' as const }));
          setBusy(false);
          if (done.ok) router.refresh();
          else setError(done.error);
        }}
        className="min-h-11 rounded-xl bg-white px-4 text-sm font-extrabold text-red hover:brightness-95 focus-visible:outline-white disabled:opacity-60"
      >
        {t('dashboard.emergency.resolve')}
      </button>
      {error && (
        <span role="alert" className="text-sm font-bold">
          {t(error)}
        </span>
      )}
    </span>
  );
}
