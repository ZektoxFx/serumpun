'use client';

import Link from 'next/link';
import { Sheet } from '@/components/ui/Sheet';
import { CREATE_ACTIONS } from '@/lib/domain/nav';
import { useT } from '@/lib/i18n';

/** The quick actions behind the + button. Esc, the backdrop and the close button close it, and so does picking a link. */
export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('nav.create')}>
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
                {action.icon}
              </span>
              {t(action.label)}
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
