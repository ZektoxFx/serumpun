'use client';

import { useState } from 'react';
import { readCode, register, sendSms } from '@/app/(auth)/register/actions';
import { PinPad } from '@/components/card/PinPad';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { focusOnMount, stepHeading } from '@/components/ui/stepHeading';
import { formatCode } from '@/lib/card/codes';
import type { PinAnswer } from '@/lib/card/pin';
import type { Home } from '@/lib/card/register';
import { clockTime, TZ } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';
import { PhoneStep, SmsStep, useRequest, type SmsSent } from './PhoneSignIn';

type Step = 'code' | 'home' | 'phone' | 'sms' | 'pin';

/**
 * Registering with a code, one screen at a time: the code, the home it is for, the SMS code, then the PIN twice. An
 * office code texts the number on the office's record; an invite asks for the person's own. `initialCode` is Try
 * registering's code, which comes in a cookie and never in the URL.
 */
export function RegisterFlow({ initialCode }: { initialCode: string | null }) {
  const t = useT();
  const lang = useLang();
  const request = useRequest();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : '');
  const [home, setHome] = useState<Home | null>(null);
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<SmsSent | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  // Yes, this is me (an office code), Send code (an invite), and Send a new code.
  async function send(): Promise<string | null> {
    const answer = await sendSms(code, home?.kind === 'invite' ? phone : null);
    if ('error' in answer) return t(answer.error);
    setSent(answer);
    setStep('sms');
    return null;
  }

  // The PIN twice on one pad: the first is kept, and the second must match it before the account is made.
  async function enterPin(check: string, typed: string): Promise<PinAnswer> {
    if (pin === null) {
      setPin(typed);
      return { ok: true };
    }
    if (typed !== pin) {
      setPin(null);
      return { ok: false, error: 'register.pin.mismatch' };
    }
    const { error } = await register(code, check, typed); // the right one signs in and opens Me
    // Only "try again" stays on the pad. The rest go back to the screen that can mend them: a new SMS code, or the code.
    if (error !== 'common.error') {
      setStep(error === 'sms.error.expired' ? 'sms' : 'code');
      request.setMessage(t(error));
    }
    return { ok: false, error };
  }

  if (step === 'home' && home) {
    return (
      <section aria-labelledby="home-title" className="grid gap-4">
        <h2 id="home-title" ref={focusOnMount} tabIndex={-1} className={stepHeading}>
          {home.kind === 'office' ? t('register.home.title') : t('register.invite.title', { unit: home.unit })}
        </h2>
        <div className="grid gap-1 rounded-2xl border border-line bg-surface p-4 shadow-card">
          {home.kind === 'office' ? (
            <>
              <p className="font-bold">{home.unit}</p>
              <p className="text-sm text-muted-2">{home.township}</p>
              <p className="mt-2">
                <span className="font-bold">{home.name}</span> · {t(`units.tenure.${home.tenure}`)}
              </p>
              <p className="text-sm text-muted-2">
                {t('register.home.checked', { time: clockTime(new Date(home.checkedAt), new Date(), lang) })}
              </p>
              {home.leaseEnd && (
                <p className="text-sm text-muted-2">
                  {t('register.home.leaseEnd', {
                    date: new Intl.DateTimeFormat(lang === 'ms' ? 'ms-MY' : 'en-MY', {
                      timeZone: TZ,
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(home.leaseEnd)),
                  })}
                </p>
              )}
            </>
          ) : (
            <>
              <p>
                <span className="font-bold">{home.name}</span> · {t(`household.role.${home.role}`)}
              </p>
              {home.invitedBy && <p className="text-sm text-muted-2">{t('register.invite.by', { name: home.invitedBy })}</p>}
            </>
          )}
        </div>
        {request.message && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {request.message}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          disabled={request.busy}
          // An office code texts the office's number at once; an invite asks for the person's own first.
          onClick={() => (home.kind === 'office' ? void request.run(send) : setStep('phone'))}
        >
          {t('register.home.yes')}
        </Button>
        {home.kind === 'office' && <p className="text-center text-sm text-muted-2">{t('register.home.notYou')}</p>}
      </section>
    );
  }

  if (step === 'phone') return <PhoneStep phone={phone} setPhone={setPhone} request={request} send={send} autoFocus />;

  if (step === 'sms' && sent) {
    return (
      <SmsStep
        key={sent.check}
        sent={sent}
        office={home?.kind === 'office'}
        request={request}
        resend={send}
        onChecked={() => {
          setPin(null);
          setStep('pin');
        }}
      />
    );
  }

  if (step === 'pin' && sent) {
    return (
      <section aria-labelledby="pin-title" className="grid gap-4">
        {/* Keyed by the entry, so the second one's heading mounts afresh: it takes the focus and is read out. */}
        <h2 key={pin === null ? 'choose' : 'again'} id="pin-title" ref={focusOnMount} tabIndex={-1} className={stepHeading}>
          {t(pin === null ? 'register.pin.choose' : 'register.pin.again')}
        </h2>
        {/* One pad for both: a mismatch shows its message under "Choose" again. */}
        <PinPad check={(typed) => enterPin(sent.check, typed)} />
        {pin === null && <p className="text-sm text-muted-2">{t('register.pin.why')}</p>}
      </section>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void request.run(async () => {
          const answer = await readCode(code);
          if ('error' in answer) return t(answer.error);
          setHome(answer.home);
          setStep('home');
          return null;
        });
      }}
      className="grid gap-4"
    >
      <Field label={t('register.code.title')} hint={t('register.code.hint')} error={request.message}>
        {(control) => (
          <input
            {...control}
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={`${control.className} font-mono text-xl uppercase tracking-widest`}
          />
        )}
      </Field>
      <p className="text-sm text-muted-2">
        {t('register.agree')}{' '}
        {/* A new tab, so reading them does not lose the steps so far. */}
        <a href="/help/terms" target="_blank" rel="noopener" className="font-bold text-text underline">
          {t('help.terms')}
        </a>
        .
      </p>
      <Button type="submit" size="lg" disabled={request.busy}>
        {t('common.next')}
      </Button>
    </form>
  );
}
