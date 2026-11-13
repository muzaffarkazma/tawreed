'use client';
import { useActionState } from 'react';
import { updateCompanyAction, type SimpleState } from '@/app/actions/admin';
import type { Dict } from '@/lib/i18n';

export function CompanyForm({ c, t }: { c: { name: string; city: string; phone: string; cr: string; vat: string }; t: Dict }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(updateCompanyAction, {});
  return (
    <form action={action} className="card mt-5 space-y-4" data-testid="company-form">
      {state.error && <div className="err">{state.error}</div>}
      {state.ok && <div className="ok" data-testid="company-saved">{state.ok}</div>}
      <label className="block"><span className="label">{t.signup.name}</span><input className="input" name="name" defaultValue={c.name} required data-testid="co-name" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">{t.signup.city}</span><input className="input" name="city" defaultValue={c.city} required /></label>
        <label className="block"><span className="label">{t.signup.phone}</span><input className="input" name="phone" defaultValue={c.phone} /></label>
        <label className="block"><span className="label">{t.signup.cr}</span><input className="input bg-sunk" value={c.cr} readOnly dir="ltr" /></label>
        <label className="block"><span className="label">{t.signup.vat}</span><input className="input bg-sunk" value={c.vat} readOnly dir="ltr" /></label>
      </div>
      <p className="text-xs text-muted">{t.companyPage.locked}</p>
      <button className="btn-pri" disabled={pending} data-testid="co-save">{t.companyPage.save}</button>
    </form>
  );
}
