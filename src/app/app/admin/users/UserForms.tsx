'use client';
import { useActionState, useRef } from 'react';
import { createUserAction, resetPasswordAction, toggleActiveAction, changeRoleAction, type UserActionState } from '@/app/actions/users';
import type { Dict } from '@/lib/i18n';

type Role = { id: string; label: string };

function TempPassword({ temp, t }: { temp: { email: string; password: string }; t: Dict['users'] }) {
  return (
    <div className="ok mt-3" data-testid="temp-password-box">
      <div className="font-semibold">{t.tempPw}: <code className="rounded bg-surface px-2 py-0.5 font-mono text-ink" dir="ltr" data-testid="temp-password">{temp.password}</code></div>
      <div className="mt-1 text-xs">{temp.email} — {t.tempNote}</div>
    </div>
  );
}

export function AddUserForm({ roles, t }: { roles: Role[]; t: Dict['users'] }) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(createUserAction, {});
  const form = useRef<HTMLFormElement>(null);
  return (
    <section className="card">
      <h2 className="font-semibold">{t.add}</h2>
      <form ref={form} action={action} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_200px_auto] sm:items-end" data-testid="add-user-form">
        <label><span className="label">{t.name}</span><input className="input" name="name" required data-testid="nu-name" /></label>
        <label><span className="label">{t.email}</span><input className="input" name="email" type="email" required dir="ltr" data-testid="nu-email" /></label>
        <label><span className="label">{t.role}</span>
          <select className="input" name="role" required data-testid="nu-role" defaultValue={roles[1]?.id}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select></label>
        <button className="btn-pri" disabled={pending} data-testid="nu-submit">{t.create}</button>
      </form>
      {state.error && <div className="err mt-3" role="alert" data-testid="nu-error">{state.error}</div>}
      {state.temp && <TempPassword temp={state.temp} t={t} />}
    </section>
  );
}

export function RoleSelect({ userId, role, roles, label }: { userId: string; role: string; roles: Role[]; label: string }) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(changeRoleAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <select className="input py-1.5 text-xs" name="role" defaultValue={role} aria-label={label} disabled={pending}
        data-testid={`role-select-${userId}`} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      {state.error && <div className="mt-1 text-xs text-bad" role="alert">{state.error}</div>}
      {state.saved && !pending && <div className="mt-1 text-xs text-brand-ink" data-testid={`role-saved-${userId}`}>✓</div>}
    </form>
  );
}

export function UserRowActions({ userId, active, t }: { userId: string; active: boolean; t: Dict['users'] }) {
  const [toggleState, toggle, p1] = useActionState<UserActionState, FormData>(toggleActiveAction, {});
  const [resetState, reset, p2] = useActionState<UserActionState, FormData>(resetPasswordAction, {});
  return (
    <div className="min-w-[220px]">
      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={reset}><input type="hidden" name="userId" value={userId} /><button className="btn btn-sm" disabled={p2} data-testid={`reset-${userId}`}>{t.reset}</button></form>
        <form action={toggle}><input type="hidden" name="userId" value={userId} /><button className={active ? 'btn-danger btn-sm' : 'btn btn-sm'} disabled={p1} data-testid={`toggle-${userId}`}>{active ? t.deactivate : t.activate}</button></form>
      </div>
      {toggleState.error && <div className="mt-1 text-xs text-bad" role="alert" data-testid="row-error">{toggleState.error}</div>}
      {resetState.temp && <TempPassword temp={resetState.temp} t={t} />}
    </div>
  );
}
