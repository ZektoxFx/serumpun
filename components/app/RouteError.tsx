'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/**
 * What every segment's error.tsx shows: what happened in plain words, Try again (fetches and renders the segment again)
 * and a way home ("/" sends each user to theirs). The details stay in the server log; error.digest ties the two.
 */
export function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <p aria-hidden="true" className="text-4xl">
        ⚠️
      </p>
      <h1 className="text-lg font-extrabold">{t('error.title')}</h1>
      <p className="text-sm text-muted-2">{t('error.body')}</p>
      <Button type="button" onClick={retry}>
        {t('error.retry')}
      </Button>
      <Link href="/" className={buttonClasses('outline')}>
        {t('error.home')}
      </Link>
    </main>
  );
}
