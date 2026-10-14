'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState, type ReactNode } from 'react';
import { TABS, isActiveTab } from '@/lib/domain/nav';
import { useT } from '@/lib/i18n';
import { CreateSheet } from './CreateSheet';

// Stroke icons, so the active tab turns its icon red along with its label (an emoji cannot be recoloured).
const icons: Record<(typeof TABS)[number]['key'], ReactNode> = {
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  map: (
    <>
      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z" />
      <path d="M8 2v16M16 6v16" />
    </>
  ),
  community: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  me: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

/** Home · Map · ＋ · Community · Me, fixed to the bottom of every resident page. The + opens the Create sheet. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {TABS.map((tab, index) => {
            const active = isActiveTab(pathname, tab.href);
            return (
              <Fragment key={tab.key}>
                {/* The Create button takes the middle cell, between Map and Community. */}
                {index === 2 && (
                  <button
                    type="button"
                    aria-label={t('nav.create')}
                    aria-haspopup="dialog"
                    onClick={() => setCreating(true)}
                    className="-mt-8 grid size-15 place-items-center justify-self-center rounded-full bg-brand-gradient text-white shadow-fab transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                )}
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  // Inset focus ring: the outer tabs touch the screen edge on a phone, which would clip the global one.
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-offset-[-2px] ${active ? 'font-bold text-red-text' : 'font-semibold text-muted'}`}
                >
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {icons[tab.key]}
                  </svg>
                  {t(tab.label)}
                </Link>
              </Fragment>
            );
          })}
        </div>
      </nav>
      <CreateSheet open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
