import type { ComponentProps } from 'react';

/**
 * A small label for the gradient headers. Small text cannot sit on the gradient (white is ~3.6:1 over its orange stop),
 * so it gets a solid white chip with navy text (16:1). The navy is a literal because the gradient is the same in both
 * themes, while every navy token flips in dark mode.
 */
export function HeroChip({ className = '', ...rest }: ComponentProps<'span'>) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#001C3C] ${className}`}
      {...rest}
    />
  );
}
