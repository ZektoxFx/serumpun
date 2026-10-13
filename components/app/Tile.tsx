import Link from 'next/link';

/** One of the Home shortcuts: an emoji over a short label. `label` is already translated. */
export function Tile({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      // 11px with 2px side padding: "Perkhidmatan" (Services, Bahasa Malaysia) is the longest word and must fit a 76px tile.
      className="flex min-h-22 w-full flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-0.5 py-2 text-center text-[11px] font-bold leading-tight shadow-card transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {icon}
      </span>
      {label}
    </Link>
  );
}
