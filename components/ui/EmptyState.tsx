import type { ReactNode } from 'react';
import { Glyph } from '@/components/ui/Glyph';

/** Friendly "nothing here yet" block: an optional emoji/icon, a title, a hint and an optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && (
        <div aria-hidden="true" className="text-4xl">
          {typeof icon === 'string' ? <Glyph emoji={icon} /> : icon}
        </div>
      )}
      <p className="text-base font-extrabold text-text">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
