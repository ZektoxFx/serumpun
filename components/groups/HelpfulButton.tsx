'use client';

import { useActionState } from 'react';
import { setHelpful, type GroupActionResult } from '@/app/(app)/community/groups/actions';
import { useT } from '@/lib/i18n';

/**
 * "👍 Helpful · 9" on a comment, a toggle (aria-pressed). It sends the state it asks for, so a double tap cannot undo
 * itself. Shown as plain text where the reader cannot vote: their own comment, or a group they are not in.
 */
export function HelpfulButton({
  commentId,
  author,
  count,
  on,
  canAct,
}: {
  commentId: string;
  /** Said to screen readers after the label: "Helpful · 9, Mei Ling Tan". */
  author: string;
  count: number;
  on: boolean;
  canAct: boolean;
}) {
  const t = useT();
  const [result, act, pending] = useActionState(async (_: GroupActionResult, formData: FormData): Promise<GroupActionResult> => {
    try {
      return await setHelpful(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  if (!canAct) {
    return (
      <p className="text-xs font-bold text-muted-2">
        <span aria-hidden="true">👍 </span>
        {t('group.helpful', { n: count })}
      </p>
    );
  }
  return (
    <form action={act} className="flex flex-wrap items-center gap-x-2">
      <input type="hidden" name="id" value={commentId} />
      <input type="hidden" name="helpful" value={on ? 'no' : 'yes'} />
      <button
        aria-pressed={on}
        disabled={pending}
        className={`-mx-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-bold disabled:opacity-60 ${
          on ? 'text-green-text' : 'text-muted-2 hover:bg-chip'
        }`}
      >
        <span aria-hidden="true">👍 </span>
        {t('group.helpful', { n: count })}
        <span className="sr-only">, {author}</span>
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-xs font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
