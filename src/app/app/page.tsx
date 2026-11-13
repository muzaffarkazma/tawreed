import Link from 'next/link';
import { and, count, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withTenant, schema } from '@/db';
import { ROLES, roleLabel } from '@/lib/roles';
import { can } from '@/lib/ops/core';
import { myTasks } from '@/lib/ops/tasks';
import { getSettings, monthSpend, type Me } from '@/lib/ops/services';
import { Bar, Kpi, Sar, TurnBar, Icon, fmtDate } from '@/components/ops';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ activated?: string; denied?: string }> }) {
  const user = await requireUser();
  const { t, lang } = await getT();
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const sp = await searchParams;
  const c = user.company!;
  const me = user as Me;
  const buyer = c.type === 'buyer';
  const [tasks, d] = await Promise.all([myTasks(me), withTenant(c.id, async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(schema.users).where(and(eq(schema.users.companyId, c.id), eq(schema.users.active, true)));
    const party = or(eq(schema.orders.buyerCompanyId, c.id), eq(schema.orders.supplierCompanyId, c.id));
    const [{ active }] = await tx.select({ active: count() }).from(schema.orders).where(and(party, ne(schema.orders.status, 'closed')));
    const events = await tx.select().from(schema.caseEvents).where(or(eq(schema.caseEvents.buyerCompanyId, c.id), eq(schema.caseEvents.supplierCompanyId, c.id))).orderBy(desc(schema.caseEvents.id)).limit(12);
    if (buyer) {
      const [{ reqs }] = await tx.select({ reqs: count() }).from(schema.requests).where(and(eq(schema.requests.buyerCompanyId, c.id), inArray(schema.requests.status, ['submitted', 'sourcing'])));
      const [{ rfqs }] = await tx.select({ rfqs: count() }).from(schema.rfqs).where(and(eq(schema.rfqs.buyerCompanyId, c.id), inArray(schema.rfqs.status, ['open', 'evaluation', 'pending_approval', 'approved'])));
      const s = await getSettings(tx, c.id);
      return { n, active, events, a: reqs, b: rfqs, spend: await monthSpend(tx, c.id), limit: s.monthlyLimitHalalas };
    }
    const [{ opps }] = await tx.select({ opps: count() }).from(schema.rfqInvites).innerJoin(schema.rfqs, eq(schema.rfqs.id, schema.rfqInvites.rfqId))
      .where(and(eq(schema.rfqInvites.supplierCompanyId, c.id), inArray(schema.rfqInvites.status, ['invited', 'viewed']), eq(schema.rfqs.status, 'open'), sql`${schema.rfqs.deadline} > now()`));
    const [{ offers }] = await tx.select({ offers: count() }).from(schema.offers).where(and(eq(schema.offers.supplierCompanyId, c.id), eq(schema.offers.status, 'active')));
    const [{ due }] = await tx.select({ due: sql<number>`coalesce(sum(${schema.tradeInvoices.totalHalalas}),0)`.mapWith(Number) }).from(schema.tradeInvoices).where(and(eq(schema.tradeInvoices.supplierCompanyId, c.id), ne(schema.tradeInvoices.status, 'paid')));
    return { n, active, events, a: opps, b: offers, spend: due, limit: 0 };
  })]);
  const role = ROLES[c.type].find((r) => r.id === user.role);
  const quick: [string, string, string, boolean][] = buyer ? [
    ['/app/requests/new', L('Raise a request', 'ارفع طلباً'), 'file', can(user, 'request.create')],
    ['/app/market', L('Buy from the live market', 'اشترِ من السوق المباشر'), 'box', can(user, 'market.buy')],
    ['/app/rfqs', L('Manage RFQs', 'إدارة طلبات العروض'), 'chat', can(user, 'rfq.manage')],
    ['/app/orders', L('Track orders', 'تتبع الطلبيات'), 'truck', can(user, 'order.view')]
  ] : [
    ['/app/opportunities', L('Quote on RFQs', 'قدّم عروض أسعار'), 'chat', can(user, 'quote.submit')],
    ['/app/offers', L('Post a market offer', 'انشر عرضاً في السوق'), 'box', can(user, 'offer.manage')],
    ['/app/orders', L('Fulfil orders', 'نفّذ الطلبيات'), 'truck', can(user, 'order.view')],
    ['/app/invoices', L('Invoices and payments', 'الفواتير والمدفوعات'), 'money', can(user, 'invoice.view')]
  ];
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      {sp.activated && <div className="ok" data-testid="activated">{t.app.activated}</div>}
      {sp.denied && <div className="err" data-testid="denied">{t.app.denied}</div>}
      <div>
        <h1 className="h1" data-testid="dash-title">{t.app.welcome}{lang === 'ar' ? '، ' : ', '}<bdi>{user.name.split(' ')[0]}</bdi></h1>
        <p className="mt-1 text-sm text-muted">{t.app.yourRole}: <b className="text-ink">{roleLabel(c.type, user.role, lang)}</b> — {role?.summary[lang]}</p>
      </div>
      {tasks.length ? <TurnBar state="mine" title={L(`You have ${tasks.length} task(s) waiting`, `لديك ${tasks.length} مهام بانتظارك`)} sub={L('Everything below is waiting on your role. Lists update live.', 'كل ما يلي بانتظار دورك. القوائم تتحدث مباشرة.')} />
        : <TurnBar state="done" title={L('Nothing is waiting on you right now', 'لا شيء بانتظارك الآن')} sub={L('New work appears here and in the bell as soon as it reaches your role.', 'يظهر العمل الجديد هنا وفي الجرس فور وصوله لدورك.')} />}
      <div className="grid gap-3 sm:grid-cols-4">
        {buyer ? <>
          <Kpi label={L('Open requests', 'طلبات مفتوحة')} value={d.a} />
          <Kpi label={L('Active RFQs', 'طلبات عروض نشطة')} value={d.b} />
          <Kpi label={L('Orders in progress', 'طلبيات جارية')} value={d.active} />
          <div className="kpi"><div className="text-xs text-muted">{L('Spend this month', 'المصروف هذا الشهر')}</div><div className="num mt-1 text-xl font-semibold"><Sar h={d.spend} lang={lang} /></div><div className="mt-2"><Bar pct={(d.spend / Math.max(1, d.limit)) * 100} warn={d.spend > d.limit * 0.8} /></div><div className="mt-1 text-xs text-muted">{L('of', 'من')} <Sar h={d.limit} lang={lang} /></div></div>
        </> : <>
          <Kpi label={L('RFQs to quote', 'طلبات عروض للتقديم')} value={d.a} />
          <Kpi label={L('Live market offers', 'عروض سوق نشطة')} value={d.b} />
          <Kpi label={L('Orders in progress', 'طلبيات جارية')} value={d.active} />
          <Kpi label={L('Receivables', 'المستحقات')} value={<Sar h={d.spend} lang={lang} />} />
        </>}
      </div>
      <section className="card" data-testid="my-tasks">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[15px] font-semibold">{L('My tasks', 'مهامي')}</h2>
          <div className="flex flex-wrap gap-2">{quick.filter((q) => q[3]).map(([href, l, icon], i) => <Link key={href} href={href} className={i === 0 ? 'btn-pri btn-sm' : 'btn btn-sm'}><Icon n={icon} className="h-3.5 w-3.5" />{l}</Link>)}</div></div>
        {!tasks.length ? <div className="py-8 text-center text-muted"><b className="mb-1 block text-[15px] text-ink">{L('All clear', 'لا توجد مهام')}</b>{L('Work appears here the moment it reaches your role.', 'يظهر العمل هنا فور وصوله لدورك.')}</div> : (
          <div className="flex flex-col">{tasks.slice(0, 15).map((x, i) => (
            <Link key={`${x.href}-${x.key}`} href={x.href} data-testid="task" className={`flex items-center gap-3 border-t border-line py-3 first:border-t-0 hover:bg-sunk ${i === 0 ? '-mx-4 border-t-transparent bg-brand-soft px-4 hover:bg-brand-soft' : ''}`}>
              <span className="grid h-6 min-w-[38px] place-items-center rounded-md bg-sunk text-muted"><Icon n={x.href.includes('/orders') ? 'truck' : x.href.includes('rfq') || x.href.includes('opportun') ? 'chat' : x.href.includes('offers') ? 'box' : x.href.includes('approval') ? 'check' : 'file'} className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><b className="block font-semibold">{x.ref} · <bdi>{x.title}</bdi></b><span className="block text-[12.5px] text-muted">{x.action[lang]} · {fmtDate(x.at, lang, true)}</span></span>
              <span className="pill-warn">{L('Your turn', 'دورك')}</span><span className="btn btn-sm">{L('Open', 'فتح')}</span>
            </Link>))}
          </div>)}
      </section>
      {user.role === 'company_admin' && (
        <section className="card" data-testid="getting-started">
          <h2 className="font-semibold">{t.app.gettingStarted}</h2>
          <div className="mt-1 text-xs text-muted">{t.app.seats}: <b data-testid="seat-usage">{d.n} / {c.subscription?.maxUsers ?? '—'}</b> · {t.app.plan}: {(lang === 'ar' ? c.subscription?.planNameAr : c.subscription?.planName) ?? '—'}</div>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {(buyer ? t.app.gs : [t.app.gs[0], t.app.gs[1], L('Complete your network profile (categories, cities)', 'أكمل ملفك في الشبكة (الفئات والمدن)'), L('Post your first market offer', 'انشر أول عرض في السوق')]).map((g, i) => {
              const href = ['/app/admin/users', '/app/admin/company', buyer ? '/app/settings' : '/app/admin/company', buyer ? '/app/requests/new' : '/app/offers'][i];
              return (
                <li key={g} className="flex items-start gap-2 rounded-lg bg-canvas p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                  <Link href={href} className="font-medium text-brand-ink hover:underline">{g}</Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
