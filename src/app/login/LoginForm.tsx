'use client';
import { useActionState } from 'react';
import { loginAction, type FormState } from '@/app/actions/auth';
import type { Dict } from '@/lib/i18n';

export function LoginForm({ t }: { t: Dict['auth'] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-4 space-y-4" data-testid="login-form">
      {state.error && <div className="err" role="alert" data-testid="login-error">{state.error}</div>}
      <label className="block"><span className="label">{t.email}</span>
        <input className="input" name="email" type="email" required autoComplete="email" defaultValue={state.email} data-testid="login-email" /></label>
      <label className="block"><span className="label">{t.password}</span>
        <input className="input" name="password" type="password" required autoComplete="current-password" data-testid="login-password" /></label>
      <button className="btn-pri w-full py-2.5" disabled={pending} data-testid="login-submit">{pending ? '…' : t.login}</button>
    </form>
  );
}
