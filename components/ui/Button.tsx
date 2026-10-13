import type { ComponentProps } from 'react';

export type ButtonVariant = 'primary' | 'ink' | 'outline' | 'gradient';
export type ButtonSize = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-red text-white hover:brightness-95',
  ink: 'bg-ink text-on-ink hover:opacity-90',
  outline: 'border border-line-strong bg-surface text-text hover:bg-soft',
  // Anything focusable placed ON the gradient needs focus-visible:outline-[#001C3C]; the default red ring vanishes there.
  gradient: 'bg-brand-gradient text-white hover:brightness-95',
};

// Both sizes keep the 44px minimum touch target.
const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-13 px-6 text-base',
};

/** Classes for anything that should look like a button, e.g. `<Link className={buttonClasses('outline')}>`. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

/** Add layout classes (`w-full`), not colours. Like any <button>, it submits a surrounding form unless `type="button"`. */
export function Button({
  variant,
  size,
  className = '',
  ...rest
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...rest} />;
}
