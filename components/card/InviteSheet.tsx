'use client';

import { useState } from 'react';
import { createInvite } from '@/app/(app)/me/household/actions';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { householdErrorKey, INVITE_ROLES, type InviteChoice, type InviteRole } from '@/lib/card/household';
import type { PinAnswer } from '@/lib/card/pin';
import { clockTime } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';
import { PinPad } from './PinPad';

type Props = { cardId: string; demoPin: string | null; choices: Record<InviteRole, InviteChoice>; initialRole?: InviteRole };

// A step that replaces the one before takes the focus, so a screen reader starts reading there (as Register does).
const focusOnMount = (heading: HTMLElement | null) => heading?.focus();
const stepHeading = 'text-xl font-extrabold outline-none';

/**
 * The name and the role, then the PIN, then the code. It mounts only while the sheet is open, so closing the sheet takes the
 * code off the screen: it is shown once, and inviting again makes a new one.
 */
function InviteFlow({ cardId, demoPin, choices, initialRole }: Props) {
  const t = useT();
  const lang = useLang();
  const [name, setName] = useState('');
  const [role, setRole] = useState<InviteRole>(
    initialRole && choices[initialRole] === true ? initialRole : (INVITE_ROLES.find((r) => choices[r] === true) ?? 'child'),
  );
  const [asking, setAsking] = useState(false);
  const [made, setMade] = useState<{ code: string; expiresAt: string } | null>(null);
  const who = name.trim();
  const roleName = t(`household.role.${role}`);

  // The pad's check. Making the invite is the PIN check, so a wrong PIN and a refusal come back to the pad in words.
  async function confirm(pin: string): Promise<PinAnswer> {
    const answer = await createInvite(who, role, pin);
    if (!('code' in answer)) return answer;
    setMade(answer);
    return { ok: true };
  }

  if (made) {
    const time = clockTime(new Date(made.expiresAt), new Date(), lang);
    const message = t('invite.whatsapp.message', { name: who, url: window.location.origin, code: made.code, time });
    return (
      <div key="made" className="grid gap-4 pb-2">
        <h3 ref={focusOnMount} tabIndex={-1} className={stepHeading}>
          {t('invite.code.title', { name: who })}
        </h3>
        <div className="grid gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-soft p-4 text-center">
          <p className="font-mono text-3xl font-extrabold tracking-widest">{made.code}</p>
          <p className="text-sm text-muted-2">{t('invite.code.works', { time, name: who })}</p>
        </div>
        {/* The one place the code leaves the screen: the person chose to send it. A new tab keeps this sheet where it is. */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('primary', 'lg')}
        >
          {t('invite.whatsapp')}
        </a>
      </div>
    );
  }

  if (asking) {
    return (
      <div key="pin" className="grid gap-4 pb-2">
        <h3 ref={focusOnMount} tabIndex={-1} className={stepHeading}>
          {t('card.pin.title')}
        </h3>
        <p className="text-sm text-muted-2">
          {who} · {roleName}
        </p>
        <PinPad cardId={cardId} demoPin={demoPin} check={confirm} />
        <Button type="button" variant="outline" onClick={() => setAsking(false)}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const unavailable = INVITE_ROLES.flatMap((r) => {
    const choice = choices[r];
    return choice === true ? [] : [{ role: r, why: householdErrorKey(choice) }];
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (who) setAsking(true);
      }}
      className="grid gap-4 pb-2"
    >
      <Field label={t('invite.name')}>
        {(control) => <input {...control} name="name" required maxLength={40} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />}
      </Field>
      <div className="grid gap-1.5">
        <p className="text-sm font-bold">{t('invite.role')}</p>
        <Segmented
          value={role}
          onChange={setRole}
          label={t('invite.role')}
          options={INVITE_ROLES.map((r) => ({ value: r, label: t(`household.role.${r}`), disabled: choices[r] !== true }))}
        />
        {unavailable.map(({ role: r, why }) => (
          <p key={r} className="text-sm text-muted-2">
            <span className="font-bold">{t(`household.role.${r}`)}</span> · {t(why)}
          </p>
        ))}
      </div>
      <Button type="submit" size="lg" disabled={!who}>
        {t('invite.confirm')}
      </Button>
    </form>
  );
}

/**
 * "Invite someone" for a manager of the card, and the sheet it opens. `choices` says which roles the card allows and why
 * not the others. With `initialRole` (from "Add a Co-owner") the sheet opens at once on that role.
 */
export function InviteSheet(props: Props) {
  const t = useT();
  const [open, setOpen] = useState(props.initialRole !== undefined);
  return (
    <>
      <Button type="button" size="lg" aria-haspopup="dialog" onClick={() => setOpen(true)} className="w-full">
        {t('household.invite')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('household.invite')}>
        <InviteFlow {...props} />
      </Sheet>
    </>
  );
}
