import { useId, type ReactNode } from 'react';

type ControlProps = {
  id: string;
  className: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};

// 44px tall, 16px text (smaller text makes iOS zoom the page on focus).
const controlClass =
  'block min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-base text-text placeholder:text-muted disabled:opacity-50 aria-invalid:border-red-text';

/**
 * A labelled form control with optional hint and error text, wired for screen readers.
 * Spread the props it hands you onto your own input, textarea or select:
 *   <Field label={t('x')}>{(control) => <input {...control} name="email" type="email" />}</Field>
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-text">
        {label}
      </label>
      {children({
        id,
        className: controlClass,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-bold text-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
