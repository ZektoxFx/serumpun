'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/**
 * A pill switcher ("Offered | Requested") built as an ARIA radio group of buttons: one tab stop,
 * arrow keys move and select. Controlled: `value` in, `onChange(next)` out. `label` names the group.
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
  options: readonly { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // If `value` matches nothing, the first option still takes the tab stop so the group stays reachable.
  const tabStop = options.some((o) => o.value === value) ? value : options[0]?.value;

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next: number;
    if (step) next = (index + step + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
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
            tabIndex={option.value === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-extrabold transition-colors duration-150 motion-reduce:transition-none ${
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
