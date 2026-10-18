'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Glyph';
import { IconButton, type IconButtonTone } from '@/components/ui/IconButton';
import { useT } from '@/lib/i18n';

/**
 * "←": back where the resident came from, or to `fallback` when this page opened first (a link from a notification).
 * `tone="overlay"` on the brand gradient.
 */
export function BackButton({ fallback, tone }: { fallback: string; tone?: IconButtonTone }) {
  const router = useRouter();
  const t = useT();
  return (
    <IconButton tone={tone} label={t('common.back')} onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}>
      <Icon name="back" className="size-5" />
    </IconButton>
  );
}
