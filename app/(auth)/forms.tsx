'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useT } from '@/lib/i18n';
import type { DemoAccount } from '@/lib/seed/people';
import { signIn, signInDemo, type AuthResult } from './actions';

// The forms use noValidate: the server's checks come back in the reader's language, the browser's bubbles would not.

function FormError({ result }: { result: AuthResult }) {
  const t = useT();
  return result?.error ? (
    <p role="alert" className="text-sm font-bold text-red-text">
      {t(result.error)}
    </p>
  ) : null;
}

/** `next`: where to go after signing in (the landing page's `?next=`), checked again on the server. */
export function DemoButtons({ next }: { next?: string }) {
  const t = useT();
  const [result, action, pending] = useActionState(
    (_: AuthResult, formData: FormData) => signInDemo(formData.get('who') as DemoAccount, next),
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

export function SignInForm({ next }: { next?: string }) {
  const t = useT();
  const [result, action, pending] = useActionState((_: AuthResult, formData: FormData) => signIn(formData), null);
  return (
    <form action={action} noValidate className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
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
