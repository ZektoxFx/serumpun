'use client';

import { useOptimistic, useTransition } from 'react';
import { setTextSize } from '@/app/(app)/me/actions';
import { Segmented } from '@/components/ui/Segmented';
import { useT } from '@/lib/i18n';
import { TEXT_SCALE, TEXT_SIZES, type TextSize } from '@/lib/textSize';

/** Small to Extra large. The page resizes at once; the server keeps the choice in a cookie for the next visit. */
export function TextSizeSwitch({ size }: { size: TextSize }) {
  const t = useT();
  const [shown, setShown] = useOptimistic(size);
  const [, startTransition] = useTransition();
  return (
    <Segmented
      label={t('me.textSize')}
      value={shown}
      onChange={(next) =>
        startTransition(async () => {
          setShown(next);
          document.documentElement.style.fontSize = TEXT_SCALE[next];
          await setTextSize(next);
        })
      }
      options={TEXT_SIZES.map((s) => ({ value: s, label: t(`text.${s}`) }))}
    />
  );
}
