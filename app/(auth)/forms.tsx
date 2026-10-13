'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import type { SignupInput } from '@/lib/domain/signup';
import { useT } from '@/lib/i18n';
import type { DemoAccount } from '@/lib/seed/people';
import { signIn, signInDemo, signUp, type AuthResult } from './actions';

// The forms use noValidate: the server's checks come back in the reader's language, the browser's bubbles would not.

function FormError({ result }: { result: AuthResult }) {
  const t = useT();
  return result?.error ? (
    <p role="alert" className="text-sm font-bold text-red-text">
      {t(result.error)}
    </p>
  ) : null;
}

export function DemoButtons() {
  const t = useT();
  const [result, action, pending] = useActionState(
    (_: AuthResult, formData: FormData) => signInDemo(formData.get('who') as DemoAccount),
    null,
  );
  return (
    <form action={action} className="grid gap-3">
      <Button name="who" value="aisyah" size="lg" disabled={pending}>
        {t('landing.demo.aisyah')}
      </Button>
      <Button name="who" value="nur" variant="outline" size="lg" disabled={pending}>
        {t('landing.demo.nur')}
      </Button>
      <Button name="who" value="office" variant="ink" size="lg" disabled={pending}>
        {t('landing.demo.office')}
      </Button>
      <FormError result={result} />
    </form>
  );
}

export function SignInForm() {
  const t = useT();
  const [result, action, pending] = useActionState((_: AuthResult, formData: FormData) => signIn(formData), null);
  return (
    <form action={action} noValidate className="grid gap-4">
      <Field label={t('auth.email')}>
        {(control) => (
          <input {...control} name="email" type="email" autoComplete="email" required defaultValue={result?.values?.email} />
        )}
      </Field>
      <Field label={t('auth.password')}>
        {(control) => <input {...control} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <FormError result={result} />
      <Button type="submit" size="lg" disabled={pending}>
        {t('auth.signIn')}
      </Button>
    </form>
  );
}

export function SignUpForm({ townships }: { townships: { slug: string; name: string; active: boolean }[] }) {
  const t = useT();
  const [result, action, pending] = useActionState((_: AuthResult, formData: FormData) => signUp(formData), null);
  const values = result?.values ?? {};
  const error = (name: keyof SignupInput) => {
    const key = result?.errors?.[name];
    return key && t(key);
  };
  return (
    <form action={action} noValidate className="grid gap-4">
      <Field label={t('signup.township')} error={error('townshipSlug')}>
        {(control) => (
          <select {...control} name="townshipSlug" defaultValue={values.townshipSlug ?? townships.find((x) => x.active)?.slug}>
            {townships.map((township) => (
              <option key={township.slug} value={township.slug} disabled={!township.active}>
                {township.active ? township.name : t('signup.comingSoon', { name: township.name })}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('signup.neighbourhood')} hint={t('signup.neighbourhood.hint')} error={error('neighbourhood')}>
        {(control) => <input {...control} name="neighbourhood" required maxLength={80} defaultValue={values.neighbourhood} />}
      </Field>
      <Field label={t('signup.unitNo')} hint={t('signup.unitNo.hint')} error={error('unitNo')}>
        {(control) => (
          <input {...control} name="unitNo" required maxLength={40} autoComplete="address-line1" defaultValue={values.unitNo} />
        )}
      </Field>
      <Field label={t('signup.fullName')} error={error('fullName')}>
        {(control) => (
          <input {...control} name="fullName" required maxLength={80} autoComplete="name" defaultValue={values.fullName} />
        )}
      </Field>
      <Field label={t('auth.email')} error={error('email')}>
        {(control) => (
          <input {...control} name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={values.email} />
        )}
      </Field>
      <Field label={t('auth.password')} hint={t('signup.password.hint')} error={error('password')}>
        {(control) => <input {...control} name="password" type="password" required minLength={8} autoComplete="new-password" />}
      </Field>
      <FormError result={result} />
      <Button type="submit" size="lg" disabled={pending}>
        {t('signup.submit')}
      </Button>
    </form>
  );
}
