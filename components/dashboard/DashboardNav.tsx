'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type DashboardNavItem = {
  href: string;
  icon: string;
  label: string;
  /** A count on a red badge, with the words a screen reader hears for it ("16 open"). */
  badge?: { n: number; label: string };
};

/** The Management Office's sidebar menu. The labels arrive translated from the server layout. */
export function DashboardNav({ label, items }: { label: string; items: DashboardNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="grid gap-1 min-[900px]:gap-0.5">
        {items.map((item) => {
          const current = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-white ${
                  current ? 'bg-white/15 font-extrabold text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge.n > 0 && (
                  <>
                    <span aria-hidden="true" className="rounded-full bg-red px-2 text-xs font-extrabold leading-5 text-white">
                      {item.badge.n}
                    </span>
                    <span className="sr-only">, {item.badge.label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
