'use client';

import { startTransition, useActionState, useId, useRef, useState, type ReactNode } from 'react';
import { createPost, type GroupActionResult } from '@/app/(app)/community/groups/actions';
import { Button, buttonClasses } from '@/components/ui/Button';
import { POST_TYPES, type PostType } from '@/lib/domain/community';
import { useT } from '@/lib/i18n';

/**
 * A member's posting box: type (General, Question, Share & Lend) and text. A new member first sees a welcome card whose
 * "Say hi" fills the box with `sayHi`; `children` (the pinned event) sits between the two.
 */
export function PostComposer({
  groupId,
  groupName,
  sayHi,
  canPost,
  children,
}: {
  groupId: string;
  groupName: string;
  /** The greeting "Say hi" writes, or null when the member is not new. */
  sayHi: string | null;
  canPost: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const ids = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false); // a second tap before the first post is back would post twice
  const [body, setBody] = useState('');
  const [type, setType] = useState<PostType>('general');
  const [result, post, pending] = useActionState(async (_: GroupActionResult, formData: FormData): Promise<GroupActionResult> => {
    try {
      const done = await createPost(formData);
      if (done?.ok) {
        setBody('');
        setType('general');
      }
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    } finally {
      sending.current = false;
    }
  }, null);

  return (
    <>
      {sayHi && (
        <div className="grid gap-2 rounded-2xl bg-tint-blue p-3.5">
          <p className="text-sm">
            <span aria-hidden="true">👋 </span>
            {t('group.welcome', { group: groupName })}
          </p>
          <button
            type="button"
            disabled={!canPost}
            onClick={() => {
              setBody(sayHi);
              box.current?.focus();
            }}
            className={`${buttonClasses('outline')} justify-self-start`}
          >
            {t('group.sayHi')}
          </button>
        </div>
      )}
      {children}
      <form
        // Not `action={post}`: React resets a form after every action, which would wipe the text when posting fails.
        onSubmit={(event) => {
          event.preventDefault();
          if (sending.current) return;
          sending.current = true;
          startTransition(() => post(new FormData(event.currentTarget)));
        }}
        className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-card"
      >
        <input type="hidden" name="group" value={groupId} />
        <label htmlFor={`${ids}-body`} className="sr-only">
          {t('group.composer')}
        </label>
        <textarea
          ref={box}
          id={`${ids}-body`}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          required
          disabled={!canPost}
          placeholder={t('group.composer.placeholder')}
          className="block w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-base text-text placeholder:text-muted disabled:opacity-50"
        />
        <div className="flex items-center gap-2">
          <label htmlFor={`${ids}-type`} className="sr-only">
            {t('group.composer.type')}
          </label>
          <select
            id={`${ids}-type`}
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as PostType)}
            disabled={!canPost}
            className="min-h-11 min-w-0 rounded-xl border border-line-strong bg-surface px-3 text-sm font-bold text-text disabled:opacity-50"
          >
            {POST_TYPES.map((p) => (
              <option key={p} value={p}>
                {t(`group.type.${p}`)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!canPost || pending || body.trim() === ''} className="ml-auto shrink-0">
            {t('group.composer.submit')}
          </Button>
        </div>
        {result && !result.ok && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {t(result.error)}
          </p>
        )}
      </form>
    </>
  );
}
