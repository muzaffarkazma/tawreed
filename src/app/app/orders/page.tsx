import Link from 'next/link';
import { desc, eq, or } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { can } from '@/lib/ops/core';
import { flowStep } from '@/lib/ops/flow';
import { roleLabel } from '@/lib/roles';
import { Empty, Kpi, PageHead, Sar, StatusPill, fmtDate } from '@/components/ops';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { me, lang, L } = await opsPage({ perms: ['order.view'] });
  const sp = await searchParams;
  const side = me.company.type;
  const rows = await withTenant(me.company.id, (tx) => tx.select().from(schema.orders)
    .where(or(eq(schema.orders.buyerCompanyId, me.company.id), eq(schema.orders.supplierCompanyId, me.company.id))).orderBy(desc(schema.orders.updatedAt)).limit(300));
  const mine = (o: (typeof rows)[number]) => { const s = flowStep(o.status); return s.side === side && can(me, s.perm); };
  const ours = (o: (typeof rows)[number]) => flowStep(o.status).side === side;
  const f = sp.f ?? 'all';
  const list = rows.filter((o) => f === 'mine' ? mine(o) : f === 'active' ? o.status !== 'closed' : f === 'closed' ? o.status === 'closed' : true);
  const chips: [string, string][] = [['all', L('All', 'الكل')], ['mine', L('My turn', 'دوري')], ['active', L('In progress', 'جارية')], ['closed', L('Closed', 'مغلقة')]];
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <PageHead title={L('Orders', 'الطلبيات')} sub={L('Every purchase order and market order, from acceptance to payment. Each order shows whose turn it is.', 'كل أوامر الشراء وطلبات السوق من القبول حتى الدفع. كل طلب يوضح دور من الآن.')} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label={L('My turn', 'دوري')} value={rows.filter(mine).length} testId="orders-mine" />
        <Kpi label={L('In progress', 'جارية')} value={rows.filter((o) => o.status !== 'closed').length} />
        <Kpi label={L('In transit', 'قيد النقل')} value={rows.filter((o) => o.status === 'in_transit').length} />
        <Kpi label={L('Value (incl. VAT)', 'القيمة (شامل الضريبة)')} value={<Sar h={rows.reduce((s, o) => s + o.totalHalalas, 0)} lang={lang} />} />
      </div>
      <div className="flex flex-wrap gap-2">{chips.map(([id, l]) => <Link key={id} href={id === 'all' ? '/app/orders' : `/app/orders?f=${id}`} className={f === id ? 'chip-on' : 'chip'}>{l}</Link>)}</div>
      {!list.length ? <Empty title={L('No orders here', 'لا توجد طلبات')} body={side === 'buyer' ? L('Orders appear when you buy from the market or issue a PO from an RFQ.', 'تظهر الطلبات عند الشراء من السوق أو إصدار أمر شراء.') : L('Orders appear when a buyer buys your offer or awards you an RFQ.', 'تظهر الطلبات عندما يشتري مشترٍ عرضك أو يرسي عليك طلب عروض.')} /> : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl" data-testid="orders-table">
            <thead><tr><th>{L('Order', 'الطلب')}</th><th>{side === 'buyer' ? L('Supplier', 'المورد') : L('Buyer', 'المشتري')}</th><th>{L('Total', 'الإجمالي')}</th><th>{L('Status', 'الحالة')}</th><th>{L('Next step', 'الخطوة التالية')}</th></tr></thead>
            <tbody>{list.map((o) => {
              const s = flowStep(o.status);
              return (
                <tr key={o.id} data-testid={`order-${o.number}`}>
                  <td><Link href={`/app/orders/${o.id}`} className="font-medium text-brand-ink hover:underline">{o.number}</Link><div className="text-xs text-muted">{o.kind === 'po' ? L('Purchase order', 'أمر شراء') : L('Market order', 'طلب سوق')} · {fmtDate(o.createdAt, lang)}</div></td>
                  <td><bdi>{side === 'buyer' ? o.supplierName : o.buyerName}</bdi></td>
                  <td><Sar h={o.totalHalalas} lang={lang} /></td>
                  <td><StatusPill kind="order" status={o.status} lang={lang} />{o.replacement && <span className="pill-bad ms-1">{L('Replacement', 'بديلة')}</span>}</td>
                  <td className="text-xs">{o.status === 'closed' ? <span className="text-muted">—</span> : mine(o) ? <span className="pill-ok">● {s.action[lang]}</span> : ours(o) ? <span className="text-muted">{roleLabel(side, s.roles[0], lang)}: {s.action[lang]}</span> : <span className="text-muted">{L('Waiting on', 'بانتظار')} <bdi>{side === 'buyer' ? o.supplierName : o.buyerName}</bdi></span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
