import Link from 'next/link';
import { desc, eq, or } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { Empty, Kpi, PageHead, Sar, StatusPill, fmtDate, Pill } from '@/components/ops';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const { me, lang, L } = await opsPage({ perms: ['invoice.view'] });
  const rows = await withTenant(me.company.id, (tx) => tx.select({ i: schema.tradeInvoices, o: schema.orders }).from(schema.tradeInvoices).innerJoin(schema.orders, eq(schema.orders.id, schema.tradeInvoices.orderId))
    .where(or(eq(schema.tradeInvoices.buyerCompanyId, me.company.id), eq(schema.tradeInvoices.supplierCompanyId, me.company.id))).orderBy(desc(schema.tradeInvoices.issuedAt)).limit(300));
  const buyer = me.company.type === 'buyer';
  const sum = (f: (x: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, x) => s + x.i.totalHalalas, 0);
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHead title={L('Invoices', 'الفواتير')} sub={buyer ? L('ZATCA e-invoices from your suppliers, matched against PO, receipt and quality before payment.', 'فواتير إلكترونية من الموردين تُطابق مع أمر الشراء والاستلام والجودة قبل الدفع.') : L('E-invoices you issued and their payment status.', 'الفواتير الإلكترونية التي أصدرتها وحالة دفعها.')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label={buyer ? L('To pay', 'للدفع') : L('Outstanding', 'غير مدفوعة')} value={<Sar h={sum((x) => x.i.status === 'submitted')} lang={lang} />} />
        <Kpi label={L('Variance (held)', 'فروقات (معلقة)')} value={<Sar h={sum((x) => x.i.status === 'variance')} lang={lang} />} />
        <Kpi label={L('Paid', 'مدفوعة')} value={<Sar h={sum((x) => x.i.status === 'paid')} lang={lang} />} />
      </div>
      {!rows.length ? <Empty title={L('No invoices yet', 'لا توجد فواتير بعد')} body={L('Suppliers invoice after the buyer’s quality check passes.', 'يُصدر المورد الفاتورة بعد اجتياز فحص الجودة لدى المشتري.')} /> : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl" data-testid="invoices-table">
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{buyer ? L('Supplier', 'المورد') : L('Buyer', 'المشتري')}</th><th>{L('Order', 'الطلب')}</th><th>{L('Total incl. VAT', 'الإجمالي شامل الضريبة')}</th><th>{L('3-way match', 'المطابقة')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
            <tbody>{rows.map(({ i, o }) => (
              <tr key={i.id} data-testid={`inv-${i.number}`}>
                <td><b>{i.number}</b><div className="text-xs text-muted">{fmtDate(i.issuedAt, lang, true)}</div></td>
                <td><bdi>{buyer ? o.supplierName : o.buyerName}</bdi></td>
                <td><Link className="text-brand-ink hover:underline" href={`/app/orders/${o.id}`}>{o.number}</Link></td>
                <td><Sar h={i.totalHalalas} lang={lang} /></td>
                <td>{i.match?.ok ? <Pill tone="ok">✓ {L('Matched', 'مطابقة')}</Pill> : <Pill tone="bad">{L('Variance', 'فرق')}</Pill>}</td>
                <td><StatusPill kind="invoice" status={i.status} lang={lang} />{i.autoPaid && <span className="pill-info ms-1">{L('auto', 'تلقائي')}</span>}{i.paidAt && <div className="text-xs text-muted">{fmtDate(i.paidAt, lang)}</div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
