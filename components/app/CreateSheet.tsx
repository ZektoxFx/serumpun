'use client';

import Link from 'next/link';
import { Glyph } from '@/components/ui/Glyph';
import { Sheet } from '@/components/ui/Sheet';
import { CREATE_ACTIONS } from '@/lib/domain/nav';
import { useT } from '@/lib/i18n';

/**
 * The quick actions behind the + button. Esc, the backdrop and the close button close it, and so does picking a link.
 * Emergency alert arms the + like holding it does, for anyone who cannot hold a button for 3 seconds.
 */
export function CreateSheet({ open, onClose, onEmergency }: { open: boolean; onClose: () => void; onEmergency: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('nav.create')}>
      <button
        type="button"
        onClick={onEmergency}
        className="mb-2 mt-1 flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-red bg-tint-red px-3 text-left hover:brightness-95"
      >
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-red text-xl font-extrabold text-white">
          !
        </span>
        <span className="flex flex-col">
          <span className="text-base font-extrabold text-red-text">{t('emergency.arm')}</span>
          <span className="text-xs text-muted-2">{t('emergency.armHint')}</span>
        </span>
      </button>
      <ul className="grid gap-2 pb-2 pt-1">
        {CREATE_ACTIONS.map((action) => (
          <li key={action.href}>
            {/* The sheet is not closed by navigating (the nav bar stays mounted), so the link closes it. */}
            <Link
              href={action.href}
              onClick={onClose}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3 text-base font-bold hover:bg-soft"
            >
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-chip text-xl">
                <Glyph emoji={action.icon} />
              </span>
              {t(action.label)}
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
