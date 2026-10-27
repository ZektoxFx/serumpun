'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/** Where an arrow, Home or End key moves the choice from option `from`, among the options that are not disabled. Null for any other key. */
export function moveChoice(options: readonly { disabled?: boolean }[], from: number, key: string): number | null {
  const live = options.flatMap((o, i) => (o.disabled ? [] : [i]));
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[key];
  if (live.length === 0) return null;
  if (step) return live[(live.indexOf(from) + step + live.length) % live.length];
  if (key === 'Home') return live[0];
  if (key === 'End') return live[live.length - 1];
  return null;
}

/**
 * A pill switcher ("Offered | Requested") built as an ARIA radio group of buttons: one tab stop,
 * arrow keys move and select. Controlled: `value` in, `onChange(next)` out. `label` names the group.
 * An option can be `disabled`: it cannot be chosen, and the keys pass over it.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // If `value` matches nothing that can be chosen, the first option that can still takes the tab stop so the group stays reachable.
  const tabStop = options.some((o) => o.value === value && !o.disabled) ? value : options.find((o) => !o.disabled)?.value;

  function onKeyDown(event: KeyboardEvent, index: number) {
    const next = moveChoice(options, index, event.key);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-xl bg-chip p-1 ${className}`}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={option.value === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-extrabold leading-tight transition-colors duration-150 disabled:opacity-50 motion-reduce:transition-none ${
              selected ? 'bg-surface text-text shadow-card' : 'text-muted'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
