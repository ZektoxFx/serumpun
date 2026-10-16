'use client';

import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { startConversation, type MessageActionResult } from '@/app/(app)/messages/actions';
import { buttonClasses } from '@/components/ui/Button';
import type { ContextType } from '@/lib/domain/messages';
import { useT } from '@/lib/i18n';

/**
 * "Message Priya" on something a neighbour posted: opens the conversation about it with them, the same one every time.
 * The database finds who posted it, so the button names only the thing. Pending residents see it switched off.
 */
export function MessageButton({
  contextType,
  contextId,
  label,
  canAct,
}: {
  contextType: ContextType;
  contextId: string;
  label: string;
  canAct: boolean;
}) {
  const t = useT();
  const router = useRouter();
  // `action={act}` is fine: the form holds only hidden fields.
  const [result, act, pending] = useActionState(async (_: MessageActionResult, formData: FormData): Promise<MessageActionResult> => {
    try {
      const done = await startConversation(formData);
      if (done?.ok) router.push(`/messages/${done.id}`);
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={act} className="flex flex-col items-start gap-1">
      <input type="hidden" name="type" value={contextType} />
      <input type="hidden" name="id" value={contextId} />
      {/* Stays off after success too, while the page moves to the conversation. */}
      <button disabled={!canAct || pending || result?.ok === true} className={buttonClasses('outline')}>
        <span aria-hidden="true">💬</span> {label}
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
