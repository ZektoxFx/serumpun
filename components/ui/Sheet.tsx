'use client';

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { IconButton } from './IconButton';

export type SheetSide = 'bottom' | 'right' | 'full';

// No display utility (flex, block...) on the <dialog> itself: it would override `display: none` while closed.
// The slide is motion-safe because `open:` is more specific than `motion-reduce:animate-none`, so that could never switch it off.
const sides: Record<SheetSide, string> = {
  bottom: 'inset-x-0 bottom-0 top-auto mx-auto max-h-[90dvh] w-full max-w-md rounded-t-3xl motion-safe:open:animate-sheet-up',
  right: 'inset-y-0 left-auto right-0 h-full max-h-none w-full max-w-md rounded-l-3xl motion-safe:open:animate-sheet-left',
  full: 'inset-0 h-dvh max-h-none w-full max-w-none',
};

/**
 * A modal sheet on a native <dialog>: focus is trapped, the page behind is inert, and Esc or a tap on
 * the backdrop closes it. Controlled: keep `open` in your state and clear it in `onClose`.
 * Children are only mounted while open. It does not close itself on navigation: call `onClose` from
 * the onClick of any link inside it.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'bottom',
  className = '',
  children,
  ...rest
}: Omit<ComponentProps<'dialog'>, 'open' | 'onClose' | 'title'> & {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  side?: SheetSide;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={title ? titleId : undefined}
      // The browser closed it (Esc, Android back) while the parent still says `open`: tell the parent.
      // Ignore the `close` event of our own close(), which can arrive late, after the parent has already
      // moved on (e.g. opened another sheet) and would otherwise be undone by calling onClose again.
      onClose={(event) => {
        if (open && !event.currentTarget.open) onClose();
      }}
      // A click that lands on the dialog element itself is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`fixed m-0 overflow-y-auto overscroll-contain bg-surface p-0 text-text shadow-xl backdrop:animate-fade-in backdrop:bg-black/50 motion-reduce:backdrop:animate-none ${sides[side]} ${className}`}
      {...rest}
    >
      {/* Fills the dialog so a click on empty space inside the panel is not mistaken for the backdrop. */}
      <div className="flex min-h-full flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-surface px-4 pb-2 pt-4">
          {title && (
            <h2 id={titleId} className="text-lg font-extrabold">
              {title}
            </h2>
          )}
          <IconButton label={t('common.close')} onClick={onClose} className="ml-auto">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
        <div className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{open && children}</div>
      </div>
    </dialog>
  );
}
