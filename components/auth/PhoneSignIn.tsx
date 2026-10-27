'use client';

import Link from 'next/link';
import { useState } from 'react';
import { checkSms, sendSignInSms, signInWithPin } from '@/app/(auth)/actions';
import { PinPad } from '@/components/card/PinPad';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { focusOnMount, stepHeading } from '@/components/ui/stepHeading';
import type { PinAnswer } from '@/lib/card/pin';
import { formatPhone } from '@/lib/domain/phone';
import { useT } from '@/lib/i18n';

// Sign in with a phone, and the phone and SMS steps Register uses too (RegisterFlow.tsx).

/** An SMS check that was started: its id, its code (shown on screen: there is no SMS provider) and the number, +601…. */
export type SmsSent = { check: string; sms: string; phone: string };

/** One request at a time for the step on screen: its buttons wait meanwhile, and `message` says what went wrong. */
export function useRequest() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run(request: () => Promise<string | null>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await request());
    } catch {
      setMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, setMessage, run };
}

type Request = ReturnType<typeof useRequest>;

/** The number to text, typed the usual Malaysian ways (012-345 6789, +60 12-345 6789), and Send code. */
export function PhoneStep({
  phone,
  setPhone,
  request: { busy, message, run },
  send,
  autoFocus,
}: {
  phone: string;
  setPhone: (phone: string) => void;
  request: Request;
  send: () => Promise<string | null>;
  autoFocus?: boolean;
}) {
  const t = useT();
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void run(send);
      }}
      className="grid gap-4"
    >
      <Field label={t('phone.label')} error={message}>
        {(control) => (
          <input
            {...control}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            autoFocus={autoFocus}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        {t('sms.send')}
      </Button>
    </form>
  );
}

/**
 * Where the SMS code went, the demo's note with the code, one try at it, and a new code. Mount it with `key={sent.check}`
 * so a new code starts with an empty field.
 */
export function SmsStep({
  sent,
  office = false,
  request: { busy, message, run },
  resend,
  onChecked,
}: {
  sent: SmsSent;
  office?: boolean;
  request: Request;
  resend: () => Promise<string | null>;
  onChecked: () => void;
}) {
  const t = useT();
  const phone = formatPhone(sent.phone);
  return (
    <section aria-labelledby="sms-title" className="grid gap-4">
      <h2 id="sms-title" ref={focusOnMount} tabIndex={-1} className={stepHeading}>
        {t('sms.title')}
      </h2>
      <p>{t(office ? 'register.sms.office' : 'sms.sent', { phone })}</p>
      <p role="note" className="rounded-xl bg-tint-amber px-4 py-3 text-sm font-bold text-amber-text">
        {t('register.sms.demo', { code: `${sent.sms.slice(0, 3)} ${sent.sms.slice(3)}` })}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // Copied from the note above, the code has a space in it.
          const sms = String(new FormData(event.currentTarget).get('sms') ?? '').replace(/\s/g, '');
          void run(async () => {
            const answer = await checkSms(sent.check, sms);
            if (!answer.ok) return t(answer.error, { n: answer.triesLeft ?? 0 });
            onChecked();
            return null;
          });
        }}
        className="grid gap-4"
      >
        <Field label={t('sms.label')} error={message}>
          {(control) => <input {...control} name="sms" inputMode="numeric" autoComplete="one-time-code" required />}
        </Field>
        <Button type="submit" size="lg" disabled={busy}>
          {t('common.next')}
        </Button>
      </form>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void run(resend)}>
        {t('sms.resend')}
      </Button>
    </section>
  );
}

/** Sign in with a phone: the number, the SMS code sent to it, then the PIN. `next` is where to go after, checked again on the server. */
export function PhoneSignIn({ next }: { next?: string }) {
  const t = useT();
  const request = useRequest();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<SmsSent | null>(null);
  const [checked, setChecked] = useState(false);

  // Send code, and Send a new code. Any Malaysian mobile number gets one, so this never shows who has an account.
  async function send(): Promise<string | null> {
    const answer = await sendSignInSms(phone);
    if ('error' in answer) return t(answer.error);
    setSent(answer);
    return null;
  }

  async function checkPin(check: string, pin: string): Promise<PinAnswer> {
    const answer = await signInWithPin(check, pin, next); // the right PIN signs in and redirects
    // A wrong PIN can be tried again. Anything else needs a new SMS code, so it starts again from the number.
    if (!answer.ok && answer.error !== 'signIn.error.wrong') {
      setSent(null);
      setChecked(false);
      request.setMessage(t(answer.error));
    }
    return answer;
  }

  return (
    <div className="grid gap-6">
      {!sent ? (
        <PhoneStep phone={phone} setPhone={setPhone} request={request} send={send} />
      ) : !checked ? (
        <SmsStep key={sent.check} sent={sent} request={request} resend={send} onChecked={() => setChecked(true)} />
      ) : (
        <section aria-labelledby="pin-title" className="grid gap-4">
          <h2 id="pin-title" ref={focusOnMount} tabIndex={-1} className={stepHeading}>
            {t('card.pin.title')}
          </h2>
          <PinPad check={(pin) => checkPin(sent.check, pin)} />
        </section>
      )}
      <p className="text-sm text-muted-2">
        {t('signIn.newHere')}{' '}
        <Link href="/register" className="font-bold text-text underline">
          {t('landing.register')}
        </Link>
      </p>
    </div>
  );
}
