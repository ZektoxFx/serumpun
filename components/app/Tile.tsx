import Link from 'next/link';
import { Glyph, Icon } from '@/components/ui/Glyph';

/**
 * One of the Home shortcuts: the team's icon (in brand red) over a short label. `label` is already translated. `badge`
 * (e.g. "NEW") sits on the top right; `more` draws More's icon instead.
 */
export function Tile({ href, icon, label, badge, more = false }: { href: string; icon: string; label: string; badge?: string; more?: boolean }) {
  return (
    <Link
      href={href}
      // 11px with 2px side padding: "Perkhidmatan" (Services, Bahasa Malaysia) is the longest word and must fit a 76px tile.
      className="relative flex min-h-22 w-full flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-0.5 py-2 text-center text-[0.6875rem] font-bold leading-tight shadow-card transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {badge && <span className="absolute right-1 top-1 rounded-full bg-red px-1.5 text-[0.5625rem] font-extrabold leading-relaxed text-white">{badge}</span>}
      {more ? <Icon name="more" className="size-7 text-red-text" /> : <Glyph emoji={icon} className="text-2xl leading-none text-red-text" />}
      {label}
    </Link>
  );
}
