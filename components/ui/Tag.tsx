import type { ComponentProps } from 'react';

export type TagVariant = 'info' | 'orange' | 'purple' | 'green' | 'amber';

const variants: Record<TagVariant, string> = {
  info: 'bg-tint-blue text-text',
  orange: 'bg-tint-orange text-orange-text',
  purple: 'bg-tint-purple text-purple-text',
  green: 'bg-tint-green text-green-text',
  amber: 'bg-tint-amber text-amber-text',
};

/** Small uppercase label for a category or status ("TUTORING", "REQUEST"). Not interactive. */
export function Tag({ variant = 'info', className = '', ...rest }: ComponentProps<'span'> & { variant?: TagVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
