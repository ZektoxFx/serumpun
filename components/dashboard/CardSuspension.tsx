'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { liftSuspension, suspendCard } from '@/app/dashboard/units/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useT, type MessageKey } from '@/lib/i18n';

type Answer = { error?: MessageKey } | null;

function Failed({ answer }: { answer: Answer }) {
  const t = useT();
  return answer?.error ? (
    <p role="alert" className="text-sm font-bold text-red-text">
      {t(answer.error)}
    </p>
  ) : null;
}

/** "Suspend…" opens the reason in place. The reason is required, 1 to 200 characters, and everyone on the card is told it. */
function Suspend({ card, unit }: { card: string; unit: string }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [answer, suspend, pending] = useActionState(async (_: Answer, formData: FormData): Promise<Answer> => {
    try {
      const done = await suspendCard(card, String(formData.get('reason') ?? ''));
      if (!done.error) setAsking(false);
      return done;
    } catch {
      return { error: 'common.error' };
    }
  }, null);
  const home = <span className="sr-only"> {unit}</span>; // the visible column says which home; screen readers hear it here

  return (
    <div className="grid gap-2">
      <Button ref={trigger} type="button" variant="outline" aria-expanded={asking} onClick={() => setAsking(!asking)} className="justify-self-start">
        {t('units.suspend')}
        {home}
      </Button>
      {asking && (
        <form
          // Not `action={suspend}`: React resets a form after every action, which would wipe the reason when Suspend fails.
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => suspend(new FormData(event.currentTarget)));
          }}
          className="grid min-w-64 gap-2"
        >
          <Field
            label={
              <>
                {t('units.reason')}
                {home}
              </>
            }
            hint={t('units.reasonHint')}
          >
            {(control) => <input {...control} name="reason" required maxLength={200} autoComplete="off" autoFocus />}
          </Field>
          <Failed answer={answer} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {t('units.suspendNow')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAsking(false);
                trigger.current?.focus(); // the field is gone, so keyboard focus goes back to where it came from
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** "Lift" ends a suspension at once: nothing to type, and everyone on the card is told. */
function Lift({ card, unit }: { card: string; unit: string }) {
  const t = useT();
  const [answer, lift, pending] = useActionState(async (): Promise<Answer> => {
    try {
      return await liftSuspension(card);
    } catch {
      return { error: 'common.error' };
    }
  }, null);
  return (
    // `action={lift}` is fine: the form holds nothing to lose.
    <form action={lift} className="grid justify-items-start gap-1">
      <Button variant="outline" disabled={pending}>
        {t('units.lift')}
        <span className="sr-only"> {unit}</span>
      </Button>
      <Failed answer={answer} />
    </form>
  );
}

/** What the office can do to a unit's card: Lift when it is suspended, otherwise Suspend… with a reason. */
export function CardSuspension({ card, unit, suspended }: { card: string; unit: string; suspended: boolean }) {
  return suspended ? <Lift card={card} unit={unit} /> : <Suspend card={card} unit={unit} />;
}
