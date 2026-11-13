'use client';
import { useActionState } from 'react';
import { signupAction, type SignupState } from '@/app/actions/signup';
import type { Dict } from '@/lib/i18n';

export function SignupForm({ planId, cycle, audience, t, auth }: { planId: string; cycle: string; audience: 'buyer' | 'supplier'; t: Dict['signup']; auth: Dict['auth'] }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="mt-6 space-y-6" data-testid="signup-form">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="cycle" value={cycle} />
      <input type="hidden" name="type" value={audience} />
      {state.error && <div className="err" role="alert" data-testid="signup-error">{state.error}</div>}
      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold">{t.companySection} · {audience === 'buyer' ? t.buyer : t.supplier}</legend>
        <Field label={t.name} name="name" defaultValue={f.name} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.cr} name="cr" defaultValue={f.cr} required inputMode="numeric" placeholder="1010123456" />
          <Field label={t.vat} name="vat" defaultValue={f.vat} required inputMode="numeric" placeholder="310123456700003" />
          <Field label={t.city} name="city" defaultValue={f.city} required placeholder="Riyadh" />
          <Field label={t.phone} name="phone" defaultValue={f.phone} placeholder="+966 5x xxx xxxx" />
        </div>
      </fieldset>
      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold">{t.adminSection}</legend>
        <Field label={t.adminName} name="adminName" defaultValue={f.adminName} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={auth.email} name="email" type="email" defaultValue={f.email} required autoComplete="email" />
          <div>
            <Field label={auth.password} name="password" type="password" required autoComplete="new-password" />
            <p className="mt-1 text-xs text-muted">{auth.rule}</p>
          </div>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{t.terms}</p>
        <button className="btn-pri px-6 py-2.5" disabled={pending} data-testid="signup-submit">{pending ? '…' : t.submit}</button>
      </div>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" name={name} id={name} data-testid={`f-${name}`} {...rest} />
    </label>
  );
}
