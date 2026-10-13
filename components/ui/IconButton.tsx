import type { ComponentProps } from 'react';

type Tone = 'default' | 'overlay';

const tones: Record<Tone, string> = {
  default: 'border border-line bg-surface text-text hover:bg-soft',
  // For the gradient header. The global red focus ring vanishes on the red-orange-amber gradient (it is the
  // same in both themes), so this tone draws a navy one: 3.25:1 or better along the whole gradient. A literal
  // on purpose: every navy token (ink, text, sidebar) flips in dark mode, and this must not.
  overlay: 'border border-white/45 bg-white/20 text-white hover:bg-white/30 focus-visible:outline-[#001C3C]',
};

/** A round 44px icon-only button. `label` is its accessible name, since there is no visible text. */
export function IconButton({
  label,
  tone = 'default',
  type = 'button',
  className = '',
  ...rest
}: Omit<ComponentProps<'button'>, 'aria-label'> & { label: string; tone?: Tone }) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg transition-[background-color,transform] duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${tones[tone]} ${className}`}
      {...rest}
    />
  );
}
