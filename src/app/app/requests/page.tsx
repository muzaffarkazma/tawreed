import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { can } from '@/lib/ops/core';
import { Empty, Kpi, PageHead, Sar, StatusPill, fmtDate, Banner } from '@/components/ops';
import { cityName } from '@/lib/ops/catalog';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ s?: string; err?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['request.create', 'request.triage'] });
  const sp = await searchParams;
  const rows = await withTenant(me.company.id, (tx) => tx.select({
    r: schema.requests,
    lines: sql<number>`(select count(*) from request_lines l where l.request_id = ${schema.requests.id})`.mapWith(Number),
    routed: sql<number>`(select count(*) from request_lines l where l.request_id = ${schema.requests.id} and l.route is not null)`.mapWith(Number)
  }).from(schema.requests).where(eq(schema.requests.buyerCompanyId, me.company.id)).orderBy(desc(schema.requests.createdAt)).limit(200));
  const filter = sp.s ?? 'all';
  const list = rows.filter((x) => filter === 'all' || x.r.status === filter);
  const count = (s: string) => rows.filter((x) => x.r.status === s).length;
  const chips: [string, string][] = [['all', L('All', 'الكل')], ['submitted', L('Awaiting triage', 'بانتظار الفرز')], ['sourcing', L('Sourcing', 'قيد التوريد')], ['done', L('Ordered', 'تم الطلب')], ['cancelled', L('Cancelled', 'ملغاة')]];
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHead title={L('Requests', 'الطلبات')} sub={L('Requirements raised by your team. Procurement triages each one: buy now from the live market or send to an RFQ.', 'احتياجات يرفعها فريقك. تقوم المشتريات بفرز كل طلب: شراء فوري من السوق أو إرساله كطلب عروض.')}
        right={can(me, 'request.create') && <Link href="/app/requests/new" className="btn-pri" data-testid="new-request">+ {L('New request', 'طلب جديد')}</Link>} />
      <Banner err={sp.err} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label={L('Awaiting triage', 'بانتظار الفرز')} value={count('submitted')} />
        <Kpi label={L('Sourcing', 'قيد التوريد')} value={count('sourcing')} />
        <Kpi label={L('Ordered', 'تم الطلب')} value={count('done')} />
        <Kpi label={L('Estimated value open', 'القيمة التقديرية المفتوحة')} value={<Sar h={rows.filter((x) => x.r.status === 'submitted' || x.r.status === 'sourcing').reduce((s, x) => s + x.r.estimatedHalalas, 0)} lang={lang} />} />
      </div>
      <div className="flex flex-wrap gap-2">{chips.map(([id, l]) => <Link key={id} href={id === 'all' ? '/app/requests' : `/app/requests?s=${id}`} className={filter === id ? 'chip-on' : 'chip'}>{l}</Link>)}</div>
      {!list.length ? (
        <Empty title={L('No requests yet', 'لا توجد طلبات بعد')} body={L('Describe what you need in plain words; AI turns it into line items with a price estimate.', 'اكتب احتياجك بكلمات بسيطة، ويحوّله الذكاء الاصطناعي إلى بنود مع تقدير للسعر.')}
          cta={can(me, 'request.create') && <Link href="/app/requests/new" className="btn-pri">{L('Raise a request', 'ارفع طلباً')}</Link>} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl" data-testid="requests-table">
            <thead><tr><th>{L('Request', 'الطلب')}</th><th>{L('Delivery', 'التسليم')}</th><th>{L('Lines', 'البنود')}</th><th>{L('Estimate', 'التقدير')}</th><th>{L('Raised by', 'رفعه')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
            <tbody>{list.map(({ r, lines, routed }) => (
              <tr key={r.id} data-testid={`req-${r.number}`}>
                <td><Link href={`/app/requests/${r.id}`} className="font-medium text-brand-ink hover:underline">{r.number}</Link><div className="max-w-xs truncate text-xs text-muted">{r.title}</div></td>
                <td className="text-xs">{cityName(r.deliveryCity, lang)}<div className="text-muted">{r.needBy ? fmtDate(r.needBy, lang) : '—'}</div></td>
                <td className="num">{routed}/{lines}</td>
                <td><Sar h={r.estimatedHalalas} lang={lang} /></td>
                <td className="text-xs"><bdi>{r.createdByName}</bdi><div className="text-muted">{fmtDate(r.createdAt, lang, true)}</div></td>
                <td><StatusPill kind="request" status={r.status} lang={lang} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
