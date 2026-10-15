'use client';

import { useRouter } from 'next/navigation';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/lib/i18n';

/** "←": back where the resident came from, or to `fallback` when this page opened first (a link from a notification). */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <IconButton label={t('common.back')} onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </IconButton>
  );
}
