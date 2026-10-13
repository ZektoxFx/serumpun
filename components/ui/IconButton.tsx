import type { ComponentProps } from 'react';

export type IconButtonTone = 'default' | 'overlay';

const base =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg transition-[background-color,transform] duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100';

const tones: Record<IconButtonTone, string> = {
  default: 'border border-line bg-surface text-text hover:bg-soft',
  // For the gradient header. A white glyph on the gradient falls to ~2:1 at the amber end, so this is a solid white
  // circle with a navy glyph (16:1). The global red focus ring vanishes on the gradient as well, so it draws a navy
  // one: 3.25:1 or better along the whole gradient. Literals on purpose: the gradient is the same in both themes, and
  // every navy token (ink, text, sidebar) flips in dark mode, which would be wrong here.
  overlay: 'border border-transparent bg-white text-[#001C3C] hover:bg-white/90 focus-visible:outline-[#001C3C]',
};

/** Classes for anything that should look like an icon button, e.g. `<Link className={iconButtonClasses()}>`. */
export function iconButtonClasses(tone: IconButtonTone = 'default') {
  return `${base} ${tones[tone]}`;
}

/** A round 44px icon-only button. `label` is its accessible name, since there is no visible text. */
export function IconButton({
  label,
  tone = 'default',
  type = 'button',
  className = '',
  ...rest
}: Omit<ComponentProps<'button'>, 'aria-label'> & { label: string; tone?: IconButtonTone }) {
  return <button type={type} aria-label={label} className={`${iconButtonClasses(tone)} ${className}`} {...rest} />;
}
