import type { ElementType, HTMLAttributes } from 'react';

/** Rounded surface for a block of content. `flush` drops the padding (for edge-to-edge images or lists). */
export function Card({
  as = 'div',
  flush = false,
  className = '',
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'li'; flush?: boolean }) {
  const Element: ElementType = as;
  return (
    <Element
      className={`rounded-2xl border border-line bg-surface shadow-card ${flush ? '' : 'p-4'} ${className}`}
      {...rest}
    />
  );
}
