import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withTenant, schema } from '@/db';
import { listPlans } from '@/lib/plans';
import { formatSar } from '@/lib/billing';
import { changePlanAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tooMany?: string }> }) {
  const me = await requireUser({ roles: ['company_admin'] });
  const { t, lang } = await getT();
  const sp = await searchParams;
  const c = me.company!;
  const [invoices, plans] = await Promise.all([
    withTenant(c.id, (tx) => tx.select().from(schema.invoices).where(eq(schema.invoices.companyId, c.id)).orderBy(desc(schema.invoices.issuedAt))),
    listPlans()
  ]);
  const mine = plans.filter((p) => p.audience === c.type);
  const date = (d: Date) => new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium' });
  return (
    <div className="space-y-6">
      <h1 className="h1">{t.billingPage.title}</h1>
      {sp.tooMany && <div className="err">{t.billingPage.tooManyUsers}</div>}
      <section className="card" data-testid="current-plan">
        <div className="text-xs text-muted">{t.billingPage.current}</div>
        <div className="mt-1 text-lg font-semibold">{lang === 'ar' ? c.subscription?.planNameAr : c.subscription?.planName} · {c.subscription?.cycle === 'yearly' ? t.pricing.yearly : t.pricing.monthly}</div>
        {c.subscription?.currentPeriodEnd && <div className="text-sm text-muted">{t.app.renews}: {date(c.subscription.currentPeriodEnd)}</div>}
      </section>
      <section>
        <h2 className="mb-3 font-semibold">{t.billingPage.change}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {mine.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between"><b>{p.name[lang]}</b>{p.id === c.subscription?.planId && <span className="pill-ok">{t.billingPage.currentTag}</span>}</div>
              <div className="mt-1 text-sm text-muted">{p.maxUsers} {t.pricing.users} · {formatSar(p.monthlyHalalas, lang)} {t.pricing.perMonth}</div>
              <form action={changePlanAction} className="mt-3 flex gap-2">
                <input type="hidden" name="planId" value={p.id} />
                <select name="cycle" className="input py-1.5 text-xs" defaultValue="monthly"><option value="monthly">{t.pricing.monthly}</option><option value="yearly">{t.pricing.yearly}</option></select>
                <button className="btn btn-sm whitespace-nowrap" data-testid={`switch-${p.id}`}>{t.billingPage.switchTo}</button>
              </form>
            </div>
          ))}
        </div>
      </section>
      <section className="card overflow-x-auto p-0">
        <table className="tbl" data-testid="invoices-table">
          <thead><tr><th>{t.billingPage.number}</th><th>{t.billingPage.date}</th><th>{t.billingPage.amount}</th><th>{t.app.status}</th><th></th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs" dir="ltr">{i.number}</td>
                <td>{date(i.issuedAt)}</td>
                <td className="tabular-nums">{formatSar(i.totalHalalas, lang)}</td>
                <td>{i.status === 'paid' ? <span className="pill-ok">{t.billingPage.paid}</span> : i.status === 'due' ? <span className="pill-warn">{t.billingPage.due}</span> : <span className="pill-mute">void</span>}</td>
                <td>{i.status === 'due' && <Link href={`/checkout/${i.id}`} className="btn-pri btn-sm">{t.billingPage.pay}</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
