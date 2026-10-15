'use client';

import { useActionState } from 'react';
import { setMember, type GroupActionResult } from '@/app/(app)/community/groups/actions';
import { buttonClasses, type ButtonVariant } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/** "Join" a group, or (for a member) "Leave group". Pending residents see it switched off (the layout's banner says why). */
export function JoinButton({
  groupId,
  name,
  member = false,
  canAct,
  variant = 'outline',
}: {
  groupId: string;
  /** Said to screen readers after the label: "Join, Sunday Futsal Dads". */
  name: string;
  member?: boolean;
  canAct: boolean;
  variant?: ButtonVariant;
}) {
  const t = useT();
  // `action={act}` is fine: the form holds only hidden fields.
  const [result, act, pending] = useActionState(async (_: GroupActionResult, formData: FormData): Promise<GroupActionResult> => {
    try {
      return await setMember(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={act} className="grid gap-1">
      <input type="hidden" name="id" value={groupId} />
      <input type="hidden" name="member" value={member ? 'no' : 'yes'} />
      <button disabled={!canAct || pending} className={`${buttonClasses(variant)} w-full`}>
        {t(member ? 'group.leave' : 'group.join')}
        <span className="sr-only">, {name}</span>
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
