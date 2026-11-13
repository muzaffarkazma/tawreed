'use client';
import { useActionState } from 'react';
import { changePasswordAction, type FormState } from '@/app/actions/auth';
import type { Dict } from '@/lib/i18n';

export function ChangePasswordForm({ t }: { t: Dict['auth'] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="mt-4 space-y-4" data-testid="change-password-form">
      {state.error && <div className="err" role="alert" data-testid="cp-error">{state.error}</div>}
      <label className="block"><span className="label">{t.current}</span><input className="input" type="password" name="current" required autoComplete="current-password" data-testid="cp-current" /></label>
      <label className="block"><span className="label">{t.newPw}</span><input className="input" type="password" name="next" required autoComplete="new-password" data-testid="cp-next" /></label>
      <label className="block"><span className="label">{t.confirm}</span><input className="input" type="password" name="confirm" required autoComplete="new-password" data-testid="cp-confirm" /></label>
      <p className="text-xs text-muted">{t.rule}</p>
      <button className="btn-pri w-full py-2.5" disabled={pending} data-testid="cp-submit">{pending ? '…' : t.save}</button>
    </form>
  );
}
