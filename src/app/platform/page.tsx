import { desc, eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withSystem, schema } from '@/db';
import { formatSar } from '@/lib/billing';
import { setCompanyStatusAction, setVerifiedAction } from '@/app/actions/platform';

export const dynamic = 'force-dynamic';

export default async function PlatformPage() {
  await requireUser({ platform: true });
  const { t, lang } = await getT();
  const data = await withSystem(async (tx) => {
    const companies = await tx.select({
      c: schema.companies,
      users: sql<number>`(select count(*) from users u where u.company_id = companies.id and u.active)`.mapWith(Number),
      plan: sql<string | null>`(select p.name_en || ' · ' || s.cycle from subscriptions s join plans p on p.id = s.plan_id where s.company_id = companies.id and s.status = 'active' limit 1)`,
      mrr: sql<number>`coalesce((select case when s.cycle = 'yearly' then p.yearly_halalas / 12 else p.monthly_halalas end from subscriptions s join plans p on p.id = s.plan_id where s.company_id = companies.id and s.status = 'active' limit 1), 0)`.mapWith(Number)
    }).from(schema.companies).orderBy(desc(schema.companies.createdAt));
    const activity = await tx.select().from(schema.auditLog).orderBy(desc(schema.auditLog.id)).limit(15);
    const names = new Map(companies.map((r) => [r.c.id, r.c.name]));
    const profiles = await tx.select().from(schema.companyProfiles);
    const [net] = (await tx.execute(sql`select
      (select count(*) from orders where status <> 'cancelled')::int as orders,
      (select coalesce(sum(total_halalas),0) from orders where status <> 'cancelled')::bigint as gmv,
      (select count(*) from rfqs where status = 'open')::int as rfqs,
      (select count(*) from offers where status = 'active' and valid_until > now())::int as offers,
      (select count(*) from disputes where status = 'open')::int as disputes`)).rows as { orders: number; gmv: string; rfqs: number; offers: number; disputes: number }[];
    return { companies, profiles, net, activity: activity.map((a) => ({ ...a, companyName: a.companyId ? names.get(a.companyId) ?? '' : '' })) };
  });
  const active = data.companies.filter((r) => r.c.status === 'active');
  const mrr = active.reduce((s, r) => s + r.mrr, 0);
  return (
    <div className="space-y-6">

        <h1 className="h1" data-testid="platform-title">{t.platform.title}</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat k={t.platform.activeCos} v={String(active.length)} />
          <Stat k={t.platform.mrr} v={formatSar(mrr, lang)} testId="mrr" />
          <Stat k={t.platform.users} v={String(data.companies.reduce((s, r) => s + r.users, 0))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-4" data-testid="network-kpis">
          <Stat k={lang === 'ar' ? 'قيمة الطلبات (شامل الضريبة)' : 'Order value (GMV, incl. VAT)'} v={formatSar(Number(data.net.gmv), lang)} testId="gmv" />
          <Stat k={lang === 'ar' ? 'الطلبات' : 'Orders'} v={String(data.net.orders)} />
          <Stat k={lang === 'ar' ? 'طلبات عروض مفتوحة · عروض سوق نشطة' : 'Open RFQs · live market offers'} v={`${data.net.rfqs} · ${data.net.offers}`} />
          <Stat k={lang === 'ar' ? 'نزاعات مفتوحة' : 'Open disputes'} v={String(data.net.disputes)} />
        </div>
        <section className="card overflow-x-auto p-0">
          <div className="px-4 pt-4 font-semibold">{t.platform.tenants}</div>
          <table className="tbl mt-2" data-testid="tenants-table">
            <thead><tr><th>{t.signup.name}</th><th>{t.platform.type}</th><th>CR</th><th>{t.app.plan}</th><th>{t.platform.users}</th><th>{t.app.status}</th><th>{lang === 'ar' ? 'التوثيق' : 'Verified'}</th><th></th></tr></thead>
            <tbody>{data.companies.map(({ c, users, plan }) => (
              <tr key={c.id} data-testid={`tenant-${c.crNumber}`}>
                <td className="font-medium">{c.name}<div className="text-xs text-muted">{c.city}</div></td>
                <td>{c.type === 'buyer' ? t.pricing.buyers : t.pricing.suppliers}</td>
                <td className="font-mono text-xs" dir="ltr">{c.crNumber}</td>
                <td>{plan ?? '—'}</td>
                <td className="tabular-nums">{users}</td>
                <td>{c.status === 'active' ? <span className="pill-ok">active</span> : c.status === 'suspended' ? <span className="pill-bad">suspended</span> : <span className="pill-warn">pending payment</span>}</td>
                <td>{c.type === 'supplier' && (() => { const v = data.profiles.find((p) => p.companyId === c.id)?.verified; return (
                  <form action={setVerifiedAction}><input type="hidden" name="companyId" value={c.id} /><input type="hidden" name="verified" value={v ? '0' : '1'} />
                    <button className={v ? 'pill-ok' : 'pill-mute'} data-testid={`verify-${c.crNumber}`} title={lang === 'ar' ? 'تبديل' : 'Toggle'}>{v ? (lang === 'ar' ? 'موثّق ✓' : 'Verified ✓') : (lang === 'ar' ? 'غير موثّق' : 'Not verified')}</button></form>); })()}</td>
                <td>{c.status !== 'pending_payment' && (
                  <form action={setCompanyStatusAction}>
                    <input type="hidden" name="companyId" value={c.id} />
                    <input type="hidden" name="status" value={c.status === 'active' ? 'suspended' : 'active'} />
                    <button className={c.status === 'active' ? 'btn-danger btn-sm' : 'btn btn-sm'} data-testid={`status-${c.crNumber}`}>{c.status === 'active' ? t.platform.suspend : t.platform.reactivate}</button>
                  </form>)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
        <section className="card">
          <div className="font-semibold">{t.platform.recent}</div>
          <ul className="mt-2 divide-y divide-line text-sm">{data.activity.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span><code className="text-xs">{a.action}</code> {a.companyName && <span className="text-muted">· {a.companyName}</span>}</span><span className="text-xs text-muted">{new Date(a.createdAt).toLocaleString('en-GB')}</span></li>
          ))}</ul>
        </section>
    </div>
  );
}

function Stat({ k, v, testId }: { k: string; v: string; testId?: string }) {
  return <div className="rounded-xl bg-surface p-4 ring-1 ring-line"><div className="text-xs text-muted">{k}</div><div className="mt-1 text-xl font-semibold tabular-nums" data-testid={testId}>{v}</div></div>;
}
