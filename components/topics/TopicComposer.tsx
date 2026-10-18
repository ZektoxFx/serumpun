'use client';

import { startTransition, useActionState, useId, useRef, useState } from 'react';
import { sendTopicMessage, type TopicActionResult } from '@/app/(app)/community/general/actions';
import { Button } from '@/components/ui/Button';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * The topic's message box, fixed where the navigation bar would be, as MessageComposer is. `blocked` says why the reader
 * cannot post (waiting for approval, or an office-only topic), and the box stays disabled.
 */
export function TopicComposer({ topicId, title, blocked }: { topicId: string; title: string; blocked: MessageKey | null }) {
  const t = useT();
  const id = useId();
  const sending = useRef(false); // a second tap before the first message is back would send it twice
  const [body, setBody] = useState('');
  const [result, send, pending] = useActionState(async (_: TopicActionResult, formData: FormData): Promise<TopicActionResult> => {
    try {
      const done = await sendTopicMessage(formData);
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md flex-col gap-1 px-4 py-3">
        {blocked && <p className="text-sm font-bold text-amber-text">{t(blocked)}</p>}
        {result && !result.ok && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {t(result.error)}
          </p>
        )}
        <div className="flex items-end gap-2">
          <input type="hidden" name="topic" value={topicId} />
          <label htmlFor={id} className="sr-only">
            {t('general.composer', { topic: title })}
          </label>
          <textarea
            id={id}
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={1}
            maxLength={2000}
            required
            disabled={!!blocked}
            placeholder={t('general.composer', { topic: title })}
            className="block max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-text field-sizing-content placeholder:text-muted disabled:opacity-50"
          />
          <Button type="submit" disabled={!!blocked || pending || body.trim() === ''} className="shrink-0">
            {t('messages.send')}
          </Button>
        </div>
      </div>
    </form>
  );
}
