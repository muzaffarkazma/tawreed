import { asc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withTenant, schema } from '@/db';
import { ROLES } from '@/lib/roles';
import { AddUserForm, UserRowActions, RoleSelect } from './UserForms';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await requireUser({ roles: ['company_admin'] });
  const { t, lang } = await getT();
  const c = me.company!;
  const users = await withTenant(c.id, (tx) => tx.select().from(schema.users).where(eq(schema.users.companyId, c.id)).orderBy(asc(schema.users.createdAt)));
  const roles = ROLES[c.type].map((r) => ({ id: r.id, label: r.label[lang] }));
  const activeN = users.filter((u) => u.active).length;
  const max = c.subscription?.maxUsers ?? 0;
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : t.users.never);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{t.users.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t.users.sub}</p>
        </div>
        <span className={activeN >= max ? 'pill-warn' : 'pill-ok'} data-testid="seat-pill">{activeN} / {max}</span>
      </div>
      <AddUserForm roles={roles} t={t.users} />
      <div className="card overflow-x-auto p-0">
        <table className="tbl" data-testid="users-table">
          <thead><tr><th>{t.users.name}</th><th>{t.users.email}</th><th>{t.users.role}</th><th>{t.app.status}</th><th>{t.users.lastLogin}</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.email}`}>
                <td className="font-medium">{u.name}{u.id === me.id && <span className="pill-mute ms-2">{t.users.you}</span>}</td>
                <td dir="ltr" className="text-start">{u.email}</td>
                <td>{u.id === me.id ? roles.find((r) => r.id === u.role)?.label : <RoleSelect userId={u.id} role={u.role} roles={roles} label={t.users.changeRole} />}</td>
                <td>{u.active ? <span className="pill-ok">{t.users.active}</span> : <span className="pill-mute">{t.users.inactive}</span>}{u.mustChangePassword && u.active && <span className="pill-warn ms-1">🔑</span>}</td>
                <td className="text-xs text-muted">{fmt(u.lastLoginAt)}</td>
                <td>{u.id !== me.id && <UserRowActions userId={u.id} active={u.active} t={t.users} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
