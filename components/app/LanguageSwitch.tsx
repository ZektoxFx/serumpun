'use client';

import { useOptimistic, useTransition } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { useT, type Lang } from '@/lib/i18n';
import { setLang } from '@/lib/i18n/actions';

/** English / Bahasa Malaysia. The server saves the cookie and re-renders the page in the chosen language. */
export function LanguageSwitch({ lang }: { lang: Lang }) {
  const t = useT();
  const [shown, setShown] = useOptimistic(lang);
  const [, startTransition] = useTransition();
  return (
    <Segmented
      label={t('lang.label')}
      value={shown}
      onChange={(next) =>
        startTransition(async () => {
          setShown(next); // move the pill at once; the page catches up when the server answers
          await setLang(next);
        })
      }
      options={[
        { value: 'en', label: t('lang.en') },
        { value: 'ms', label: t('lang.ms') },
      ]}
    />
  );
}
