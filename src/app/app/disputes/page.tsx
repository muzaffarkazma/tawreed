import Link from 'next/link';
import { desc, eq, or } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { Empty, PageHead, StatusPill, fmtDate } from '@/components/ops';
import { DISPUTE_TYPES } from '@/lib/ops/catalog';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function DisputesPage() {
  const { me, lang, L } = await opsPage({ perms: ['dispute.raise'] });
  const rows = await withTenant(me.company.id, (tx) => tx.select().from(schema.disputes)
    .where(or(eq(schema.disputes.buyerCompanyId, me.company.id), eq(schema.disputes.supplierCompanyId, me.company.id))).orderBy(desc(schema.disputes.createdAt)).limit(200));
  const buyer = me.company.type === 'buyer';
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHead title={L('Disputes', 'النزاعات')} sub={L('Raise a dispute from the order page. Tawreed mediates within 48 hours and records the decision on the order for both sides.', 'ارفع النزاع من صفحة الطلب. تتوسط توريد خلال 48 ساعة وتسجل القرار في الطلب للطرفين.')} />
      {!rows.length ? <Empty title={L('No disputes', 'لا توجد نزاعات')} /> : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl" data-testid="disputes-table">
            <thead><tr><th>{L('Dispute', 'النزاع')}</th><th>{L('Order', 'الطلب')}</th><th>{buyer ? L('Supplier', 'المورد') : L('Buyer', 'المشتري')}</th><th>{L('Type', 'النوع')}</th><th>{L('Status', 'الحالة')}</th><th>{L('Decision', 'القرار')}</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.id}>
                <td><b>{x.number}</b><div className="text-xs text-muted">{x.raisedByName} · {fmtDate(x.createdAt, lang, true)}</div></td>
                <td><Link className="text-brand-ink hover:underline" href={`/app/orders/${x.orderId}`}>{x.orderNumber}</Link></td>
                <td><bdi>{buyer ? x.supplierName : x.buyerName}</bdi></td>
                <td className="text-xs">{DISPUTE_TYPES.find((t) => t.id === x.type)?.name[lang]}<div className="max-w-xs truncate text-muted">{x.description}</div></td>
                <td><StatusPill kind="dispute" status={x.status} lang={lang} />{x.status === 'open' && <div className="text-xs text-muted">{L('SLA', 'المهلة')} {fmtDate(x.slaDueAt, lang, true)}</div>}</td>
                <td className="max-w-xs text-xs">{x.resolution ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
