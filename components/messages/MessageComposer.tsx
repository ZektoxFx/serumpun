'use client';

import { startTransition, useActionState, useId, useRef, useState } from 'react';
import { sendMessage, type MessageActionResult } from '@/app/(app)/messages/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/** The message box, fixed to the bottom of the screen where the navigation bar would be. Emptied once sent; kept if not. */
export function MessageComposer({ conversationId, canSend }: { conversationId: string; canSend: boolean }) {
  const t = useT();
  const id = useId();
  const sending = useRef(false); // a second tap before the first message is back would send it twice
  const [body, setBody] = useState('');
  const [result, send, pending] = useActionState(async (_: MessageActionResult, formData: FormData): Promise<MessageActionResult> => {
    try {
      const done = await sendMessage(formData);
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
        {!canSend && <p className="text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>}
        {result && !result.ok && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {t(result.error)}
          </p>
        )}
        <div className="flex items-end gap-2">
          <input type="hidden" name="conversation" value={conversationId} />
          <label htmlFor={id} className="sr-only">
            {t('messages.composer')}
          </label>
          <textarea
            id={id}
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={1}
            maxLength={2000}
            required
            disabled={!canSend}
            placeholder={t('messages.composer')}
            className="block max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-text field-sizing-content placeholder:text-muted disabled:opacity-50"
          />
          <Button type="submit" disabled={!canSend || pending || body.trim() === ''} className="shrink-0">
            {t('messages.send')}
          </Button>
        </div>
      </div>
    </form>
  );
}
