import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, relTime } from '@/lib/ops/page';
import { Empty, Kpi, PageHead, StatusPill, Sar, fmtDate } from '@/components/ops';
import { cityName } from '@/lib/ops/catalog';
import { quoteNet } from '@/lib/ops/services';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const { me, lang, L } = await opsPage({ type: 'supplier', perms: ['quote.submit'] });
  const d = await withTenant(me.company.id, async (tx) => {
    const rows = await tx.select({ i: schema.rfqInvites, r: schema.rfqs }).from(schema.rfqInvites).innerJoin(schema.rfqs, eq(schema.rfqs.id, schema.rfqInvites.rfqId))
      .where(eq(schema.rfqInvites.supplierCompanyId, me.company.id)).orderBy(desc(schema.rfqInvites.createdAt)).limit(200);
    const quotes = await tx.select().from(schema.quotes).where(eq(schema.quotes.supplierCompanyId, me.company.id));
    return { rows, quotes };
  });
  const now = new Date();
  const openRows = d.rows.filter((x) => x.r.status === 'open' && x.r.deadline > now && x.i.status !== 'declined');
  const won = d.quotes.filter((q) => q.status === 'awarded');
  const decided = d.quotes.filter((q) => q.status !== 'submitted');
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHead title={L('Opportunities', 'الفرص')} sub={L('RFQs from buyers who matched your categories and cities. Quotes are sealed: no buyer or competitor sees your price before bidding closes.', 'طلبات عروض من مشترين طابقوا فئاتك ومدنك. العروض مختومة: لا يرى أحد سعرك قبل الإغلاق.')} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label={L('Open to quote', 'مفتوحة للتقديم')} value={openRows.filter((x) => x.i.status !== 'quoted').length} />
        <Kpi label={L('Quoted, waiting', 'قُدمت وبانتظار القرار')} value={d.quotes.filter((q) => q.status === 'submitted').length} />
        <Kpi label={L('Won', 'فزت بها')} value={won.length} />
        <Kpi label={L('Win rate', 'نسبة الفوز')} value={decided.length ? `${Math.round((won.length / decided.length) * 100)}%` : '—'} />
      </div>
      {!d.rows.length ? <Empty title={L('No RFQs yet', 'لا توجد طلبات عروض بعد')} body={L('Buyers are matched to you by category, city, rating and local content. Keep your company profile complete to be matched more often.', 'يُطابقك المشترون حسب الفئة والمدينة والتقييم والمحتوى المحلي. أكمل ملف شركتك لتُطابق أكثر.')} /> : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl" data-testid="opps-table">
            <thead><tr><th>RFQ</th><th>{L('Buyer', 'المشتري')}</th><th>{L('Delivery', 'التسليم')}</th><th>{L('Match', 'المطابقة')}</th><th>{L('Closes', 'الإغلاق')}</th><th>{L('My quote', 'عرضي')}</th></tr></thead>
            <tbody>{d.rows.map(({ i, r }) => {
              const q = d.quotes.find((x) => x.rfqId === r.id);
              const closed = r.status !== 'open' || r.deadline < now;
              return (
                <tr key={i.id} data-testid={`opp-${r.number}`}>
                  <td><Link href={`/app/opportunities/${r.id}`} className="font-medium text-brand-ink hover:underline">{r.number}</Link><div className="max-w-xs truncate text-xs text-muted">{r.title}</div></td>
                  <td><bdi>{r.buyerName}</bdi></td>
                  <td className="text-xs">{cityName(r.deliveryCity, lang)}</td>
                  <td className="num">{i.matchScore}</td>
                  <td className="text-xs">{fmtDate(r.deadline, lang, true)}{!closed && <div className="text-warn">{relTime(r.deadline, lang)}</div>}</td>
                  <td>{q ? <><StatusPill kind="quote" status={q.status} lang={lang} /><div className="text-xs"><Sar h={quoteNet(q)} lang={lang} /></div></> : closed ? <span className="pill-mute">{L('Closed', 'مغلق')}</span> : <StatusPill kind="invite" status={i.status} lang={lang} />}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
