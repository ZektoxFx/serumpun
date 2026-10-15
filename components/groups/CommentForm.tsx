'use client';

import { startTransition, useActionState, useId, useRef, useState } from 'react';
import { addComment, type GroupActionResult } from '@/app/(app)/community/groups/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/** A member's comment on a post. Emptied once sent; kept if sending fails. */
export function CommentForm({ postId }: { postId: string }) {
  const t = useT();
  const id = useId();
  const sending = useRef(false); // a second tap before the first comment is back would comment twice
  const [body, setBody] = useState('');
  const [result, send, pending] = useActionState(async (_: GroupActionResult, formData: FormData): Promise<GroupActionResult> => {
    try {
      const done = await addComment(formData);
      if (done?.ok) setBody('');
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    } finally {
      sending.current = false;
    }
  }, null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true;
        startTransition(() => send(new FormData(event.currentTarget)));
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="post" value={postId} />
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          {t('group.comment.label')}
        </label>
        <textarea
          id={id}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={1}
          maxLength={1000}
          required
          placeholder={t('group.comment.label')}
          className="block min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-text placeholder:text-muted"
        />
        <Button type="submit" disabled={pending || body.trim() === ''} className="shrink-0">
          {t('group.comment.submit')}
        </Button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
