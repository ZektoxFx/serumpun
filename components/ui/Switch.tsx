'use client';

import type { ComponentProps } from 'react';

/**
 * An on/off toggle. Name it with `aria-label` or `aria-labelledby` (the row text next to it).
 * Controlled: `checked` in, `onChange(next)` out.
 */
export function Switch({
  checked,
  onChange,
  ...rest
}: Omit<ComponentProps<'button'>, 'onChange' | 'role' | 'aria-checked' | 'children'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      // The button is the 44px touch target; the track inside is the visible 48x28 pill.
      className="inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
      {...rest}
    >
      <span
        className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-150 motion-reduce:transition-none ${
          checked ? 'bg-red' : 'bg-muted/70'
        }`}
      >
        <span
          className={`size-6 rounded-full bg-white shadow-card transition-transform duration-150 motion-reduce:transition-none ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}
