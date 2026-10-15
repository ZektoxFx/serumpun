'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef } from 'react';
import { redeem, type RewardResult } from '@/app/(app)/rewards/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/** "Redeem": spends the points and opens the new voucher. A double tap makes one voucher (one request id per button). */
export function RedeemButton({ rewardId, title, canAct }: { rewardId: string; title: string; canAct: boolean }) {
  const t = useT();
  const router = useRouter();
  const request = useRef<string | null>(null);
  const [result, act, pending] = useActionState(async (_: RewardResult, formData: FormData): Promise<RewardResult> => {
    // Made at the first press, not at render: the server's render would make a different one.
    request.current ??= crypto.randomUUID();
    formData.set('request', request.current);
    try {
      const done = await redeem(formData);
      if (done?.ok) router.push(`/rewards/${done.id}`);
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={act} className="grid shrink-0 justify-items-end gap-1">
      <input type="hidden" name="id" value={rewardId} />
      <Button disabled={!canAct || pending || result?.ok === true}>
        {t('reward.redeem')}
        <span className="sr-only"> {title}</span>
      </Button>
      {result && !result.ok && (
        <p role="alert" className="max-w-40 text-right text-xs font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
