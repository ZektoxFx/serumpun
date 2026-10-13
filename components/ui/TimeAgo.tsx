'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/domain/time';
import { useLang } from '@/lib/i18n';

/** "12 min ago" that stays true: it re-renders every 30 s. `date` is an ISO timestamp or a Date. */
export function TimeAgo({ date, className = '' }: { date: string | Date; className?: string }) {
  const lang = useLang();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const d = new Date(date);
  return (
    // The server rendered with its own clock a moment earlier; let the phone's text win without a warning.
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {timeAgo(d, now, lang)}
    </time>
  );
}
