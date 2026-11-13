import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, isUuid } from '@/lib/ops/page';
import { can } from '@/lib/ops/core';
import { cancelRequestAction, triageAction } from '@/app/actions/ops';
import { CaseHead, fmtDual, AIBox, ActionPanel, Activity, Banner, Sar, StatusPill, Timeline, TurnBar, WaitPanel, fmtDate, fmtQty, Pill } from '@/components/ops';
import { cityName, unitName, termName, TERMS, categoryName } from '@/lib/ops/catalog';
import { pctVs } from '@/lib/ops/matching';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter((w) => w.length > 2);

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['request.create', 'request.triage'] });
  const { id } = await params; const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const d = await withTenant(me.company.id, async (tx) => {
    const [r] = await tx.select().from(schema.requests).where(eq(schema.requests.id, id));
    if (!r) return null;
    const lines = await tx.select().from(schema.requestLines).where(eq(schema.requestLines.requestId, id)).orderBy(asc(schema.requestLines.lineNo));
    const offers = await tx.select().from(schema.offers).where(and(eq(schema.offers.status, 'active'), gt(schema.offers.validUntil, new Date())));
    const index = await tx.select().from(schema.priceIndex);
    const events = await tx.select().from(schema.caseEvents).where(and(eq(schema.caseEvents.refType, 'request'), eq(schema.caseEvents.refId, id))).orderBy(desc(schema.caseEvents.id)).limit(30);
    const orders = await tx.select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.requestId, id));
    const rfqs = await tx.select({ id: schema.rfqs.id, number: schema.rfqs.number, status: schema.rfqs.status }).from(schema.rfqs).where(eq(schema.rfqs.requestId, id));
    return { r, lines, offers, index, events, orders, rfqs };
  });
  if (!d) notFound();
  const { r, lines } = d;
  const triage = can(me, 'request.triage');
  const open = lines.filter((l) => !l.route);
  const matchFor = (l: (typeof lines)[number]) => d.offers.filter((o) => o.qtyAvailable >= l.qty && o.minQty <= l.qty && o.unit === l.unit &&
    (l.indexKey && o.indexKey ? o.indexKey === l.indexKey : o.category === l.category && words(o.item).some((w) => words(l.item).includes(w))))
    .sort((a, b) => a.priceNdHalalas - b.priceNdHalalas);
  const live = r.status === 'submitted' || r.status === 'sourcing';
  const marketable = open.filter((l) => matchFor(l).length);
  const steps = [
    { label: L('Request submitted', 'أُرسل الطلب'), done: true, now: false, who: r.createdByName, role: 'buyer' },
    { label: L('Procurement triage', 'فرز المشتريات'), done: r.status !== 'submitted', now: r.status === 'submitted', who: L('Procurement', 'المشتريات'), role: 'procurement' },
    { label: L('Sourcing (market / RFQ)', 'التوريد (سوق / طلب عروض)'), done: r.status === 'done', now: r.status === 'sourcing' },
    { label: L('All lines ordered', 'طُلبت كل البنود'), done: r.status === 'done', now: false }
  ];
  const msg = sp.msg === 'created' ? L('Request submitted. Procurement has been notified.', 'أُرسل الطلب وأُبلغت المشتريات.') : sp.msg === 'bought' ? L('Market order placed. The supplier has been notified.', 'صدر طلب السوق وأُبلغ المورد.') : undefined;
  return (
    <div className="space-y-5">
      <AutoRefresh />
      <Banner err={sp.err} msg={msg} />
      {r.status === 'submitted' && triage && <TurnBar state="mine" title={L('Your turn: triage this request', 'دورك: فرز هذا الطلب')} sub={L('Buy matching lines now from live offers, and send the rest to an RFQ.', 'اشترِ البنود المطابقة الآن من العروض المباشرة، وأرسل الباقي كطلب عروض.')} />}
      {r.status === 'submitted' && !triage && <TurnBar state="other" title={L('Waiting on procurement', 'بانتظار المشتريات')} sub={L('Procurement will buy from the market or run an RFQ. You will be notified.', 'ستشتري المشتريات من السوق أو تطرح طلب عروض. سيصلك إشعار.')} />}
      {r.status === 'sourcing' && <TurnBar state="wait" title={L('Sourcing in progress', 'التوريد جارٍ')} sub={L('Some lines are with an RFQ or ordered. Follow the links below.', 'بعض البنود في طلب عروض أو تم طلبها. تابع الروابط أدناه.')} />}
      {r.status === 'done' && <TurnBar state="done" title={L('All lines are ordered', 'تم طلب جميع البنود')} />}

      <CaseHead back={{ href: '/app/requests', label: L('Requests', 'الطلبات') }} id={r.number} title={r.title}
        meta={<>{me.company.name} · {cityName(r.deliveryCity, lang)}{r.project && <> · {r.project}</>}{r.costCenter && <> · {L('Cost centre', 'مركز التكلفة')} {r.costCenter}</>}</>}
        status={<StatusPill kind="request" status={r.status} lang={lang} testId="req-status" />}
        facts={[
          [L('Estimated budget (excl. VAT)', 'الميزانية التقديرية (دون الضريبة)'), <Sar key="e" h={r.estimatedHalalas} lang={lang} />],
          [L('Lines routed', 'البنود الموجهة'), `${lines.length - open.length}/${lines.length}`],
          [L('Need by', 'مطلوب بحلول'), r.needBy ? fmtDual(r.needBy, lang) : '—'],
          [L('Requested by', 'مقدم الطلب'), <bdi key="b">{r.createdByName}</bdi>]
        ]}
        pct={r.status === 'done' ? 100 : r.status === 'sourcing' ? 66 : 25} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {live && triage && open.length > 0 ? (
            <form action={triageAction}>
              <input type="hidden" name="requestId" value={r.id} />
              <ActionPanel lang={lang} title={L('Triage', 'الفرز')} testId="triage-panel"
                footer={<>
                  {can(me, 'rfq.manage') && <button className="btn" name="next" value="rfq" data-testid="triage-rfq">{marketable.length ? L('Buy ticked lines, RFQ the rest', 'اشترِ المحدد واطرح الباقي') : L('Send all to RFQ', 'أرسل الكل كطلب عروض')} →</button>}
                  {marketable.length > 0 && <button className="btn-pri" name="next" value="market" data-testid="triage-buy">{L('Buy ticked lines now', 'اشترِ البنود المحددة الآن')}</button>}
                </>}>
                <AIBox auto title={L('Market match', 'مطابقة السوق')} testId="market-match">
                  {marketable.length
                    ? L(`${marketable.length} of ${open.length} open lines can be bought right now from live offers with stock. Ticked lines become binding market orders; the rest go to an RFQ.`, `${marketable.length} من ${open.length} بنود يمكن شراؤها الآن من عروض متوفرة. البنود المحددة تصبح طلبات سوق ملزمة، والباقي يذهب لطلب عروض.`)
                    : L('No live offer covers these lines with enough stock. Send them to an RFQ to get sealed quotes.', 'لا يوجد عرض مباشر يغطي هذه البنود بكمية كافية. أرسلها كطلب عروض للحصول على عروض مختومة.')}
                </AIBox>
                <div className="space-y-3">
                  {open.map((l) => {
                    const m = matchFor(l); const best = m[0];
                    const idx = d.index.find((x) => x.key === (best?.indexKey ?? l.indexKey));
                    const vs = best && idx ? pctVs(best.priceNdHalalas, idx.valueHalalas) : null;
                    return (
                      <div key={l.id} className="rounded-lg border border-line p-3" data-testid={`triage-line-${l.lineNo}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div><b>{l.lineNo}. {l.item}</b> <span className="text-sm text-muted">{l.spec}</span></div>
                          <div className="num text-sm">{fmtQty(l.qty)} {unitName(l.unit, lang)} · {L('est.', 'تقدير')} <Sar h={l.estUnitHalalas} lang={lang} /></div>
                        </div>
                        {best ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name={`pick_${l.id}`} value={best.id} defaultChecked className="h-4 w-4 accent-brand" data-testid={`pick-${l.lineNo}`} />{L('Buy now', 'اشترِ الآن')}</label>
                            <div className="text-xs text-muted"><bdi className="font-medium text-ink">{best.supplierName}</bdi> · {best.number} · {cityName(best.city, lang)} · {best.leadDays} {L('days', 'أيام')} · {fmtQty(best.qtyAvailable)} {L('in stock', 'متوفر')}
                              {vs !== null && <span className={`ms-1 ${vs <= 0 ? 'text-ok' : 'text-bad'}`}>{vs <= 0 ? '▼' : '▲'} {Math.abs(vs).toFixed(1)}% {L('vs index', 'عن المؤشر')}</span>}
                              {m.length > 1 && <span> · {L(`${m.length - 1} more offers`, `${m.length - 1} عروض أخرى`)}</span>}</div>
                            <select name={`term_${l.id}`} defaultValue="nd" className="input py-1.5 text-xs sm:w-auto" aria-label={L('Payment term', 'شرط الدفع')}>
                              {TERMS.map((t) => <option key={t.id} value={t.id}>{t.name[lang]} · {((t.id === 'adv' ? best.priceAdvHalalas : t.id === 'nd' ? best.priceNdHalalas : best.price30Halalas) / 100).toFixed(2)}</option>)}
                            </select>
                          </div>
                        ) : <div className="mt-2 text-xs text-muted">{L('No live offer with enough stock → goes to RFQ', 'لا يوجد عرض بكمية كافية ← يذهب لطلب العروض')}</div>}
                      </div>
                    );
                  })}
                </div>
              </ActionPanel>
            </form>
          ) : live && !triage ? <WaitPanel>{L('Procurement is handling this request.', 'المشتريات تعالج هذا الطلب.')}</WaitPanel> : null}

          <section className="card overflow-x-auto p-0">
            <div className="px-4 pt-4 font-semibold">{L('Line items', 'البنود')}</div>
            <table className="tbl mt-2" data-testid="req-lines">
              <thead><tr><th>#</th><th>{L('Item', 'الصنف')}</th><th>{L('Qty', 'الكمية')}</th><th>{L('Category', 'الفئة')}</th><th>{L('Estimate', 'التقدير')}</th><th>{L('Route', 'المسار')}</th></tr></thead>
              <tbody>{lines.map((l) => {
                const o = d.orders.find((x) => x.id === l.orderId); const q = d.rfqs.find((x) => x.id === l.rfqId);
                return (
                  <tr key={l.id}>
                    <td className="num text-muted">{l.lineNo}</td>
                    <td><div className="font-medium">{l.item}</div><div className="text-xs text-muted">{l.spec}</div></td>
                    <td className="num">{fmtQty(l.qty)} {unitName(l.unit, lang)}</td>
                    <td className="text-xs">{categoryName(l.category, lang)}</td>
                    <td><Sar h={Math.round(l.qty * l.estUnitHalalas)} lang={lang} /></td>
                    <td className="text-xs">
                      {o ? <Link className="font-medium text-brand-ink hover:underline" href={`/app/orders/${o.id}`}>{o.number}</Link> : q ? <Link className="font-medium text-brand-ink hover:underline" href={`/app/rfqs/${q.id}`}>{q.number}</Link> : <Pill tone="warn">{L('Not routed', 'لم يُوجَّه')}</Pill>}
                      {l.route && <div className="text-muted">{l.route === 'market' ? L('Market', 'السوق') : 'RFQ'}</div>}
                    </td>
                  </tr>
                );
              })}</tbody>
              <tfoot><tr><td colSpan={4} className="px-3 py-2.5 text-end text-sm">{L('Estimated total (excl. VAT)', 'الإجمالي التقديري (دون الضريبة)')}</td><td className="px-3 font-semibold"><Sar h={r.estimatedHalalas} lang={lang} /></td><td /></tr></tfoot>
            </table>
          </section>
          {r.description && <section className="card"><div className="label">{L('Original description', 'الوصف الأصلي')}</div><p className="whitespace-pre-wrap text-sm">{r.description}</p><div className="mt-2 text-xs text-muted">{L('Structured by', 'حُلِّل بواسطة')}: {r.structuredBy}</div></section>}
          {r.status === 'submitted' && triage && <form action={cancelRequestAction}><input type="hidden" name="requestId" value={r.id} /><button className="btn-danger btn-sm" data-testid="cancel-request">{L('Cancel request', 'إلغاء الطلب')}</button></form>}
        </div>
        <aside className="space-y-5">
          <section className="card"><div className="mb-3 font-semibold">{L('Progress', 'المراحل')}</div><Timeline steps={steps} /></section>
          <section className="card"><div className="mb-3 font-semibold">{L('Live activity', 'النشاط المباشر')}</div><Activity events={d.events} lang={lang} empty={L('No activity yet', 'لا يوجد نشاط')} /></section>
        </aside>
      </div>
    </div>
  );
}
