import { desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withSystem, schema } from '@/db';
import { resolveDisputeAction } from '@/app/actions/platform';
import { AIBox, Banner, PageHead, StatusPill, Sar, fmtDate, tr, Kpi } from '@/components/ops';
import { DISPUTE_TYPES } from '@/lib/ops/catalog';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

/** Rule-based first suggestion for the case handler, built from the order's own evidence. */
function suggest(type: string, o: { totalHalalas: number } | undefined, lines: { item: string; qty: number; receivedQty: number | null; acceptedQty: number | null; unitHalalas: number }[], qc: { decision: string } | undefined, inv: { match: { ok: boolean; issues: string[] } | null } | undefined, lang: 'en' | 'ar') {
  const short = lines.filter((l) => l.receivedQty !== null && l.receivedQty < l.qty);
  const rej = lines.filter((l) => l.acceptedQty !== null && l.receivedQty !== null && l.acceptedQty < l.receivedQty);
  const credit = (arr: typeof lines, f: (l: (typeof lines)[number]) => number) => arr.reduce((s, l) => s + Math.round(f(l) * l.unitHalalas * 1.15), 0);
  if (type === 'short' && short.length) {
    const c = credit(short, (l) => l.qty - (l.receivedQty ?? l.qty));
    return lang === 'ar' ? `سند الاستلام يؤكد نقصاً في ${short.length} بند. اقتراح: إشعار دائن من المورد بقيمة ${(c / 100).toFixed(2)} ر.س أو توريد الكمية الناقصة خلال 3 أيام.` : `The goods receipt confirms ${short.length} short line(s). Suggested: supplier credit note of SAR ${(c / 100).toFixed(2)} incl. VAT, or deliver the balance within 3 days.`;
  }
  if (type === 'damaged' && (rej.length || qc?.decision !== 'pass')) {
    const c = credit(rej, (l) => (l.receivedQty ?? 0) - (l.acceptedQty ?? 0));
    return lang === 'ar' ? `فحص الجودة سجّل رفضاً جزئياً. اقتراح: استبدال الكمية المرفوضة أو إشعار دائن بقيمة ${(c / 100).toFixed(2)} ر.س.` : `Quality inspection recorded rejected quantities. Suggested: replace the rejected goods, or a credit note of SAR ${(c / 100).toFixed(2)} incl. VAT.`;
  }
  if (type === 'invoice' && inv?.match && !inv.match.ok) return lang === 'ar' ? `المطابقة الثلاثية فشلت: ${inv.match.issues.join('؛ ')}. اقتراح: يلغي المورد الفاتورة ويصدر فاتورة مصححة بالكميات المقبولة.` : `The 3-way match failed: ${inv.match.issues.join('; ')}. Suggested: the supplier cancels and re-issues the invoice at accepted quantities.`;
  if (type === 'late') return lang === 'ar' ? 'تحقق من تاريخ القبول ومدة التوريد المتفق عليها. اقتراح: خصم تأخير 0.5% يومياً بحد أقصى 5% إن ثبت التأخير.' : 'Check the accepted date against the agreed lead time. Suggested: a late-delivery deduction of 0.5% per day, capped at 5%, if the delay is confirmed.';
  return lang === 'ar' ? `لا توجد أدلة آلية كافية. اطلب مستندات من الطرفين قبل القرار (قيمة الطلب ${((o?.totalHalalas ?? 0) / 100).toFixed(2)} ر.س).` : `Not enough automatic evidence. Ask both parties for documents before deciding (order value SAR ${((o?.totalHalalas ?? 0) / 100).toFixed(2)}).`;
}

export default async function PlatformDisputes({ searchParams }: { searchParams: Promise<{ err?: string; msg?: string }> }) {
  await requireUser({ platform: true });
  const { lang } = await getT();
  const L = tr(lang);
  const sp = await searchParams;
  const data = await withSystem(async (tx) => {
    const ds = await tx.select().from(schema.disputes).orderBy(desc(schema.disputes.createdAt)).limit(100);
    const ids = ds.map((d) => d.orderId).concat(['00000000-0000-0000-0000-000000000000']);
    const [orders, lines, qcs, invs] = await Promise.all([
      tx.select().from(schema.orders).where(inArray(schema.orders.id, ids)),
      tx.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, ids)),
      tx.select().from(schema.qualityChecks).where(inArray(schema.qualityChecks.orderId, ids)).orderBy(desc(schema.qualityChecks.createdAt)),
      tx.select().from(schema.tradeInvoices).where(inArray(schema.tradeInvoices.orderId, ids))
    ]);
    return { ds, orders, lines, qcs, invs };
  });
  const open = data.ds.filter((d) => d.status === 'open');
  const now = Date.now();
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <PageHead title={L('Disputes', 'النزاعات')} sub={L('Cases raised by buyers or suppliers. Tawreed mediates and records the decision on the order timeline for both sides.', 'قضايا يرفعها المشترون أو الموردون. توريد تتوسط وتسجل القرار في سجل الطلب للطرفين.')} />
      <Banner err={sp.err} msg={sp.msg ? L('Dispute resolved and both companies notified.', 'حُل النزاع وأُبلغت الشركتان.') : undefined} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label={L('Open', 'مفتوحة')} value={open.length} testId="disputes-open" />
        <Kpi label={L('Past the 48 h SLA', 'تجاوزت مهلة 48 ساعة')} value={open.filter((d) => +d.slaDueAt < now).length} />
        <Kpi label={L('Resolved', 'محلولة')} value={data.ds.length - open.length} />
      </div>
      {!data.ds.length && <div className="card py-10 text-center text-sm text-muted">{L('No disputes yet.', 'لا توجد نزاعات بعد.')}</div>}
      <div className="space-y-4">
        {data.ds.map((d) => {
          const o = data.orders.find((x) => x.id === d.orderId);
          const ls = data.lines.filter((l) => l.orderId === d.orderId);
          const qc = data.qcs.find((q) => q.orderId === d.orderId);
          const inv = data.invs.find((i) => i.orderId === d.orderId);
          const late = d.status === 'open' && +d.slaDueAt < now;
          return (
            <section key={d.id} className="card space-y-3" data-testid={`dispute-${d.number}`}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{d.number}</b><StatusPill kind="dispute" status={d.status} lang={lang} />
                <span className="pill-mute">{DISPUTE_TYPES.find((x) => x.id === d.type)?.name[lang]}</span>
                {late && <span className="pill-bad">{L('SLA breached', 'تجاوز المهلة')}</span>}
                <span className="ms-auto text-xs text-muted">{L('Raised', 'رُفع')} {fmtDate(d.createdAt, lang, true)} · {L('SLA', 'المهلة')} {fmtDate(d.slaDueAt, lang, true)}</span>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div><div className="text-xs text-muted">{L('Order', 'الطلب')}</div><b>{d.orderNumber}</b>{o && <> · <Sar h={o.totalHalalas} lang={lang} /></>}</div>
                <div><div className="text-xs text-muted">{L('Buyer → Supplier', 'المشتري ← المورد')}</div><bdi>{d.buyerName}</bdi> → <bdi>{d.supplierName}</bdi></div>
                <div><div className="text-xs text-muted">{L('Raised by', 'رفعه')}</div><bdi>{d.raisedByName}</bdi></div>
              </div>
              <p className="rounded-lg bg-canvas p-3 text-sm">{d.description}</p>
              {d.status === 'open' ? (
                <>
                  <AIBox auto title={L('Suggested resolution (from order evidence)', 'الحل المقترح (من أدلة الطلب)')} testId="dispute-suggestion">
                    {suggest(d.type, o, ls, qc, inv, lang)}
                  </AIBox>
                  <form action={resolveDisputeAction} className="flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="disputeId" value={d.id} />
                    <input className="input flex-1" name="resolution" required minLength={3} placeholder={L('Decision, e.g. credit note SAR 450 agreed by both parties', 'القرار، مثل: إشعار دائن 450 ر.س باتفاق الطرفين')} data-testid="resolution" />
                    <button className="btn-pri" data-testid="resolve">{L('Resolve and notify', 'حل وإبلاغ')}</button>
                  </form>
                </>
              ) : <div className="ok">{L('Resolution', 'القرار')}: {d.resolution} <span className="text-xs">· {fmtDate(d.resolvedAt, lang, true)}</span></div>}
              {o && <div className="text-xs text-muted">{L('Order status', 'حالة الطلب')}: <StatusPill kind="order" status={o.status} lang={lang} /></div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
