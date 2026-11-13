import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { and, asc, desc, eq } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, isUuid } from '@/lib/ops/page';
import { can, lineTotal, vatOf } from '@/lib/ops/core';
import { ORDER_FLOW, flowStep, flowIndex } from '@/lib/ops/flow';
import { getSettings } from '@/lib/ops/services';
import { roleLabel } from '@/lib/roles';
import { carrierQuotes, cityName, unitName, termName, DISPUTE_TYPES, findCity, roadKm } from '@/lib/ops/catalog';
import * as A from '@/app/actions/ops';
import { CaseHead, fmtDual, AIBox, ActionPanel, Activity, Banner, Pill, Sar, StatusPill, Timeline, TurnBar, WaitPanel, fmtDate, fmtQty, Icon } from '@/components/ops';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

const QC_CHECKS = [
  { en: 'Quantity matches the delivery note', ar: 'الكمية تطابق مذكرة التسليم' },
  { en: 'Specification / grade matches the order', ar: 'المواصفات / الدرجة تطابق الطلب' },
  { en: 'Packaging and goods undamaged', ar: 'التغليف والبضاعة سليمة' },
  { en: 'Certificates and labels provided', ar: 'الشهادات والملصقات متوفرة' }
];
const RATE_TAGS = [
  { id: 'on_time', en: 'On time', ar: 'في الموعد' }, { id: 'quality', en: 'Good quality', ar: 'جودة جيدة' }, { id: 'docs', en: 'Complete documents', ar: 'مستندات كاملة' },
  { id: 'communication', en: 'Responsive', ar: 'تواصل سريع' }, { id: 'late', en: 'Late', ar: 'متأخر' }, { id: 'short', en: 'Short delivery', ar: 'نقص' }
];

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ perms: ['order.view'] });
  const { id } = await params; const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const d = await withTenant(me.company.id, async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id));
    if (!o) return null;
    const [lines, ships, qcs, invs, disputes, events, buyerSettings] = await Promise.all([
      tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, id)).orderBy(asc(schema.orderLines.lineNo)),
      tx.select().from(schema.shipments).where(eq(schema.shipments.orderId, id)).orderBy(desc(schema.shipments.dispatchedAt)),
      tx.select().from(schema.qualityChecks).where(eq(schema.qualityChecks.orderId, id)).orderBy(desc(schema.qualityChecks.createdAt)),
      tx.select().from(schema.tradeInvoices).where(eq(schema.tradeInvoices.orderId, id)),
      tx.select().from(schema.disputes).where(eq(schema.disputes.orderId, id)).orderBy(desc(schema.disputes.createdAt)),
      tx.select().from(schema.caseEvents).where(and(eq(schema.caseEvents.refType, 'order'), eq(schema.caseEvents.refId, id))).orderBy(desc(schema.caseEvents.id)).limit(60),
      me.company.type === 'buyer' ? getSettings(tx, me.company.id) : Promise.resolve(null)
    ]);
    return { o, lines, ships, qcs, invs, disputes, events, buyerSettings };
  });
  if (!d) notFound();
  const { o, lines } = d;
  const side = me.company.type;
  const other = side === 'buyer' ? o.supplierName : o.buyerName;
  const step = flowStep(o.status);
  const myTurn = step.side === side && can(me, step.perm);
  const ship = d.ships.find((s) => s.active) ?? d.ships[0];
  const inv = d.invs[0];
  const qc = d.qcs[0];
  const openDispute = d.disputes.find((x) => x.status === 'open');
  const qr = inv ? await QRCode.toDataURL(inv.qr, { margin: 1, width: 168 }) : null;
  const H = (name: string, v: string | number) => <input type="hidden" name={name} value={v} />;
  const oid = H('orderId', o.id);

  // ---------- turn bar
  const fi = flowIndex(o.status);
  const turn = o.status === 'closed' ? <TurnBar state="done" title={L('Order complete', 'اكتمل الطلب')} sub={o.rating ? L(`Rated ${o.rating}/5`, `التقييم ${o.rating}/5`) : undefined} />
    : myTurn ? <TurnBar state="mine" title={<>{L('Your turn', 'دورك')}: {step.action[lang]}</>} sub={o.replacement && o.status === 'accepted' ? L('The previous delivery was rejected by quality. Ship replacement goods.', 'رُفضت الشحنة السابقة في فحص الجودة. اشحن بضاعة بديلة.') : undefined} />
    : step.side === side ? <TurnBar state="wait" title={<>{L('Waiting on your', 'بانتظار')} {roleLabel(side, step.roles[0], lang)}: {step.action[lang]}</>} sub={L('Someone in your company with this role has been notified.', 'أُبلغ الشخص المسؤول في شركتك.')} />
    : <TurnBar state="other" title={<>{L('Waiting on', 'بانتظار')} <bdi>{other}</bdi>: {step.action[lang]}</>} sub={L('This page updates automatically.', 'هذه الصفحة تتحدث تلقائياً.')} />;

  // ---------- tracking
  const from = findCity(o.originCity), to = findCity(o.deliveryCity);
  const progress = ship ? (ship.deliveredAt ? 1 : Math.min(0.97, Math.max(0.03, (Date.now() - +ship.dispatchedAt) / Math.max(1, +ship.etaAt - +ship.dispatchedAt)))) : 0;
  const map = (() => {
    if (!from || !to || !ship || from.id === to.id) return null;
    const lons = [from.lon, to.lon], lats = [from.lat, to.lat];
    const minX = Math.min(...lons) - 1, maxX = Math.max(...lons) + 1, minY = Math.min(...lats) - 1, maxY = Math.max(...lats) + 1;
    const X = (lon: number) => 20 + ((lon - minX) / (maxX - minX)) * 360, Y = (lat: number) => 150 - ((lat - minY) / (maxY - minY)) * 130;
    const ax = X(from.lon), ay = Y(from.lat), bx = X(to.lon), by = Y(to.lat);
    return { ax, ay, bx, by, tx: ax + (bx - ax) * progress, ty: ay + (by - ay) * progress };
  })();

  // ---------- action panel
  let action: React.ReactNode = null;
  if (myTurn) {
    if (o.status === 'issued') action = (
      <form action={A.acceptOrderAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="accept-order">{L('Accept purchase order', 'قبول أمر الشراء')}</button>}>
          <p className="text-sm">{L(`Accepting confirms you will deliver ${lines.length} line(s) to ${cityName(o.deliveryCity, lang)} within ${o.leadDays} days at the prices below.`, `القبول يؤكد أنك ستورد ${lines.length} بنود إلى ${cityName(o.deliveryCity, 'ar')} خلال ${o.leadDays} أيام بالأسعار أدناه.`)}</p>
        </ActionPanel>
      </form>);
    else if (o.status === 'accepted') action = (
      <form action={A.readyAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="mark-ready">{L('Mark ready to ship', 'جاهز للشحن')}</button>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="label">{L('Delivery note no.', 'رقم مذكرة التسليم')}</span><input className="input" name="dn" required defaultValue={`DN-${o.number.split('-').at(-1)}${o.replacement ? '-R' : ''}`} data-testid="dn" /></label>
            <label><span className="label">{L('Packages / pallets', 'الطرود / المنصات')}</span><input className="input" name="packages" type="number" min={1} defaultValue={Math.max(1, Math.ceil(lines.reduce((s, l) => s + l.qty, 0) / 50))} /></label>
            <label><span className="label">{L('Certificates', 'الشهادات')}</span><input className="input" name="certs" defaultValue={L('Mill / conformity certificates attached', 'شهادات المصنع / المطابقة مرفقة')} /></label>
            <label className="sm:col-span-3"><span className="label">{L('Notes for logistics', 'ملاحظات للنقل')}</span><input className="input" name="notes" placeholder={L('Loading bay, contact, opening hours', 'رصيف التحميل، جهة الاتصال، ساعات العمل')} /></label>
          </div>
          <AIBox auto title={L('Pickup', 'الاستلام')}>{L(`The buyer's logistics team books the carrier from ${cityName(o.originCity, 'en')} once you mark it ready.`, `يحجز فريق النقل لدى المشتري الناقل من ${cityName(o.originCity, 'ar')} بعد التجهيز.`)}</AIBox>
        </ActionPanel>
      </form>);
    else if (o.status === 'ready') {
      const cq = carrierQuotes(o.originCity, o.deliveryCity);
      const rec = cq.find((c) => c.recommended)!;
      action = (
        <form action={A.dispatchAction}>{oid}
          <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="dispatch">{L('Book and dispatch', 'احجز وأرسل')}</button>}>
            <AIBox title={L('Carrier recommendation', 'توصية الناقل')} by={L('Tawreed routing', 'توجيه توريد')} testId="carrier-rec">{rec.name[lang]}: {rec.why[lang]}.</AIBox>
            <div className="grid gap-2 sm:grid-cols-3">{cq.map((c) => (
              <label key={c.id} className="cursor-pointer rounded-lg border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft" data-testid={`carrier-${c.id}`}>
                <div className="flex items-center gap-2"><input type="radio" name="carrier" value={c.id} defaultChecked={c.recommended} className="accent-brand" /><b>{c.name[lang]}</b></div>
                <div className="mt-1 text-xs text-muted">{c.vehicle[lang]} · {c.hours} {L('h', 'س')} · {c.onTime}% {L('on time', 'في الموعد')}</div>
                <div className="mt-1 font-semibold"><Sar h={c.costHalalas} lang={lang} /></div>
                {c.recommended && <div className="mt-1 text-[10.5px] font-semibold text-brand-ink">★ {L('Recommended', 'موصى به')}</div>}
              </label>))}
            </div>
            {o.docs && <div className="text-xs text-muted">{L('Supplier documents', 'مستندات المورد')}: {o.docs.deliveryNote} · {o.docs.packages} {L('packages', 'طرود')} {o.docs.notes && `· ${o.docs.notes}`}</div>}
          </ActionPanel>
        </form>);
    } else if (o.status === 'in_transit') action = (
      <form action={A.deliverAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="confirm-pod">{L('Confirm delivered', 'تأكيد التسليم')}</button>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">{L('Received by (name at site)', 'المستلم (الاسم في الموقع)')}</span><input className="input" name="podName" required minLength={2} defaultValue={me.name} data-testid="pod-name" /></label>
            <label><span className="label">{L('Delivery note / remarks', 'ملاحظات التسليم')}</span><input className="input" name="podNote" placeholder={L('e.g. signed DN, 2 pallets unloaded at gate 3', 'مثال: وُقعت المذكرة، تفريغ منصتين عند البوابة 3')} /></label>
          </div>
        </ActionPanel>
      </form>);
    else if (o.status === 'delivered') action = (
      <form action={A.receiptAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="post-grn">{L('Post goods receipt', 'تسجيل سند الاستلام')}</button>}>
          <p className="text-sm text-muted">{L('Count what arrived. Short quantities are recorded and only received goods can be invoiced.', 'عُدّ ما وصل. تُسجل الكميات الناقصة ولا يُفوتر إلا ما استُلم.')}</p>
          <table className="tbl"><thead><tr><th>{L('Item', 'الصنف')}</th><th>{L('Ordered', 'المطلوب')}</th><th>{L('Received', 'المستلم')}</th></tr></thead>
            <tbody>{lines.map((l) => <tr key={l.id}><td>{l.item}</td><td className="num">{fmtQty(l.qty)} {unitName(l.unit, lang)}</td><td><input className="input w-28 py-1.5" name={`rec_${l.id}`} type="number" step="any" min={0} max={l.qty} defaultValue={l.qty} data-testid={`rec-${l.lineNo}`} /></td></tr>)}</tbody></table>
        </ActionPanel>
      </form>);
    else if (o.status === 'received') action = (
      <form action={A.qcAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="qc-submit">{L('Record inspection', 'تسجيل الفحص')}</button>}>
          <div className="grid gap-2 sm:grid-cols-2">{QC_CHECKS.map((c, i) => (
            <label key={i} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm"><input type="hidden" name="chk_label" value={c[lang]} /><input type="checkbox" name={`chk_${i}`} defaultChecked className="h-4 w-4 accent-brand" />{c[lang]}</label>))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {([['pass', L('Pass: accept all', 'قبول الكل')], ['partial', L('Partial: accept some', 'قبول جزئي')], ['reject', L('Reject: replace all', 'رفض: استبدال الكل')]] as const).map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft" data-testid={`qc-${v}`}><input type="radio" name="decision" value={v} defaultChecked={v === 'pass'} className="accent-brand" />{l}</label>))}
          </div>
          <table className="tbl"><thead><tr><th>{L('Item', 'الصنف')}</th><th>{L('Received', 'المستلم')}</th><th>{L('Accepted (for partial)', 'المقبول (للجزئي)')}</th></tr></thead>
            <tbody>{lines.map((l) => <tr key={l.id}><td>{l.item}</td><td className="num">{fmtQty(l.receivedQty ?? l.qty)}</td><td><input className="input w-28 py-1.5" name={`acc_${l.id}`} type="number" step="any" min={0} max={l.receivedQty ?? l.qty} defaultValue={l.receivedQty ?? l.qty} data-testid={`acc-${l.lineNo}`} /></td></tr>)}</tbody></table>
          <label className="block"><span className="label">{L('Findings (required for partial or reject)', 'الملاحظات (مطلوبة للجزئي أو الرفض)')}</span><input className="input" name="notes" data-testid="qc-notes" /></label>
        </ActionPanel>
      </form>);
    else if (o.status === 'qc_passed') {
      const billed = lines.filter((l) => (l.acceptedQty ?? 0) > 0);
      const sub = billed.reduce((s, l) => s + lineTotal(l.acceptedQty ?? 0, l.unitHalalas), 0);
      action = (
        <form action={A.invoiceAction}>{oid}
          <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="issue-invoice">{L('Issue ZATCA e-invoice', 'إصدار الفاتورة الإلكترونية')}</button>}>
            <AIBox auto title={L('Invoice draft from accepted quantities', 'مسودة الفاتورة من الكميات المقبولة')}>{L('Tawreed bills exactly what the buyer accepted at the PO price, so the 3-way match passes and payment is not held.', 'تفوتر توريد ما قبله المشتري فعلاً بسعر أمر الشراء، لتنجح المطابقة الثلاثية ولا يتأخر الدفع.')}</AIBox>
            <table className="tbl"><thead><tr><th>{L('Item', 'الصنف')}</th><th>{L('Accepted', 'المقبول')}</th><th>{L('Unit price', 'السعر')}</th><th>{L('Amount', 'المبلغ')}</th></tr></thead>
              <tbody>{billed.map((l) => <tr key={l.id}><td>{l.item}</td><td className="num">{fmtQty(l.acceptedQty ?? 0)} {unitName(l.unit, lang)}</td><td><Sar h={l.unitHalalas} lang={lang} /></td><td><Sar h={lineTotal(l.acceptedQty ?? 0, l.unitHalalas)} lang={lang} /></td></tr>)}</tbody>
              <tfoot><tr><td colSpan={3} className="px-3 pt-2 text-end text-sm">{L('VAT 15%', 'ضريبة 15%')}</td><td className="px-3 pt-2"><Sar h={vatOf(sub)} lang={lang} /></td></tr><tr><td colSpan={3} className="px-3 py-2 text-end font-semibold">{L('Total', 'الإجمالي')}</td><td className="px-3 font-semibold"><Sar h={sub + vatOf(sub)} lang={lang} /></td></tr></tfoot></table>
          </ActionPanel>
        </form>);
    } else if (o.status === 'invoiced' && inv) action = (
      <form action={A.payAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={inv.status === 'variance' ? <Link href="#dispute" className="btn-danger">{L('Raise a dispute', 'ارفع نزاعاً')}</Link> : <button className="btn-pri" data-testid="pay">{L('Release payment', 'صرف الدفعة')} · <Sar h={inv.totalHalalas} lang={lang} /></button>}>
          {inv.match?.ok ? <AIBox auto title={L('3-way match passed', 'نجحت المطابقة الثلاثية')} testId="match-ok">{L('PO price, received and accepted quantities and the invoice agree.', 'سعر أمر الشراء والكميات المستلمة والمقبولة والفاتورة متطابقة.')}{d.buyerSettings && inv.totalHalalas > d.buyerSettings.autoPayLimitHalalas && <> {L('Above your auto-pay limit, so it needs your release.', 'أعلى من حد الدفع التلقائي لذا يحتاج موافقتك.')}</>}</AIBox>
            : <div className="err" data-testid="match-variance">{L('3-way match variance', 'فرق في المطابقة الثلاثية')}: {inv.match?.issues.join('; ')}</div>}
          {inv.status !== 'variance' && <label className="block max-w-sm"><span className="label">{L('Payment reference (bank transfer / SADAD)', 'مرجع الدفع (تحويل / سداد)')}</span><input className="input" name="ref" placeholder={`PAY-${inv.number}`} data-testid="pay-ref" /></label>}
        </ActionPanel>
      </form>);
    else if (o.status === 'paid') action = (
      <form action={A.rateAction}>{oid}
        <ActionPanel lang={lang} title={step.action[lang]} footer={<button className="btn-pri" data-testid="rate">{L('Submit rating and close', 'إرسال التقييم وإغلاق الطلب')}</button>}>
          <div className="flex flex-row-reverse justify-end gap-1 rtl:flex-row" data-testid="stars">
            {[5, 4, 3, 2, 1].map((n) => <label key={n} className="cursor-pointer"><input type="radio" name="stars" value={n} defaultChecked={n === 5} className="peer sr-only" /><span className="block rounded-lg border border-line px-3 py-1.5 text-sm peer-checked:border-ai-line peer-checked:bg-ai-soft peer-checked:text-ai">{'★'.repeat(n)}</span></label>)}
          </div>
          <div className="flex flex-wrap gap-2">{RATE_TAGS.map((t) => <label key={t.id} className="cursor-pointer"><input type="checkbox" name="tag" value={t.id} className="peer sr-only" /><span className="chip peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">{t[lang]}</span></label>)}</div>
          <p className="text-xs text-muted">{L('Your rating updates the supplier’s public score, which affects future RFQ matching.', 'تقييمك يحدّث درجة المورد العامة التي تؤثر في مطابقة طلبات العروض.')}</p>
        </ActionPanel>
      </form>);
  } else if (o.status !== 'closed') {
    action = <WaitPanel>{step.side === side ? L(`Your ${roleLabel(side, step.roles[0], 'en')} team will do the next step: ${step.action.en}.`, `الخطوة التالية لفريق ${roleLabel(side, step.roles[0], 'ar')}: ${step.action.ar}.`) : L(`${other} will do the next step: ${step.action.en}. You will be notified.`, `الخطوة التالية لدى ${other}: ${step.action.ar}. سيصلك إشعار.`)}</WaitPanel>;
  }

  const steps = ORDER_FLOW.filter((s) => !(o.kind === 'market' && s.status === 'issued')).map((s) => {
    const i = flowIndex(s.status);
    return { label: s.status === 'accepted' && o.kind === 'market' ? L('Market order placed', 'صدر طلب السوق') : s.label[lang], done: i < fi || o.status === 'closed', now: i === fi && o.status !== 'closed', who: s.side ? (s.side === side ? roleLabel(side, s.roles[0], lang) : other) : undefined, role: s.side ? s.roles[0] : undefined, side: s.side ?? undefined };
  });
  const msg = sp.msg === 'po' ? L('Purchase order issued and sent to the supplier.', 'صدر أمر الشراء وأُرسل للمورد.') : sp.msg === 'bought' ? L('Bought. This is a binding market order; the supplier has been notified.', 'تم الشراء. هذا طلب سوق ملزم وأُبلغ المورد.') : sp.msg === 'counter' ? L('Counter-offer accepted and order created.', 'قُبل السعر المقابل وأُنشئ الطلب.') : undefined;
  const canDispute = can(me, 'dispute.raise') && !openDispute && ['accepted', 'in_transit', 'delivered', 'received', 'qc_passed', 'invoiced', 'paid', 'closed'].includes(o.status);
  return (
    <div className="space-y-5">
      <AutoRefresh seconds={6} />
      <Banner err={sp.err} msg={msg} />
      {turn}
      <CaseHead back={{ href: '/app/orders', label: L('Orders', 'الطلبيات') }}
        id={<>{o.number}{o.kind === 'po' ? ` · ${L('Purchase order', 'أمر شراء')}` : ` · ${L('Market order', 'طلب سوق')}`}</>}
        title={lines.slice(0, 3).map((l) => l.item).join(' · ') + (lines.length > 3 ? ` +${lines.length - 3}` : '')}
        meta={<><bdi>{o.buyerName}</bdi> → <bdi>{o.supplierName}</bdi> · {cityName(o.originCity, lang)} → {cityName(o.deliveryCity, lang)}</>}
        status={<><StatusPill kind="order" status={o.status} lang={lang} testId="order-status" />{o.replacement && <Pill tone="bad">{L('Replacement due', 'مطلوب استبدال')}</Pill>}{openDispute && <Pill tone="bad" testId="dispute-open">{openDispute.number}</Pill>}</>}
        facts={[
          [L('Order value (incl. VAT)', 'قيمة الطلب (شامل الضريبة)'), <Sar key="v" h={o.totalHalalas} lang={lang} />],
          [side === 'buyer' ? L('Supplier', 'المورد') : L('Buyer', 'المشتري'), <bdi key="o">{other}</bdi>],
          [L('Payment term', 'شرط الدفع'), termName(o.paymentTerm, lang)],
          [ship && !ship.deliveredAt ? 'ETA' : L('Lead time', 'مدة التوريد'), ship && !ship.deliveredAt ? fmtDate(ship.etaAt, lang, true) : `${o.leadDays} ${L('days', 'أيام')}`],
          [L('Ordered', 'تاريخ الطلب'), fmtDual(o.createdAt, lang)]
        ]}
        pct={o.status === 'closed' ? 100 : (fi / (ORDER_FLOW.length - 1)) * 100} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {action}

          {ship && (
            <section className="card space-y-3" data-testid="tracking">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold"><Icon n="truck" />{L('Shipment', 'الشحنة')}</div>
                <div className="text-xs text-muted">{ship.carrier} · {ship.vehicle} · {L('waybill', 'البوليصة')} <b className="font-mono text-ink">{ship.waybill}</b></div></div>
              {map && (
                <div className="overflow-hidden rounded-[10px] bg-sunk" dir="ltr"><svg viewBox="0 0 400 170" className="block h-auto w-full" role="img" aria-label={L('Route map', 'خريطة المسار')}>
                  <line x1={map.ax} y1={map.ay} x2={map.bx} y2={map.by} className="stroke-line2" strokeWidth="5" strokeLinecap="round" />
                  <line x1={map.ax} y1={map.ay} x2={map.tx} y2={map.ty} className="stroke-brand" strokeWidth="5" strokeLinecap="round" />
                  <circle cx={map.ax} cy={map.ay} r="7" className="fill-surface stroke-brand" strokeWidth="2" /><circle cx={map.bx} cy={map.by} r="7" className="fill-surface stroke-brand" strokeWidth="2" />
                  <text x={map.ax} y={map.ay - 14} textAnchor="middle" fontSize="13" fontWeight="600" className="fill-ink">{cityName(o.originCity, lang)}</text>
                  <text x={map.bx} y={map.by - 14} textAnchor="middle" fontSize="13" fontWeight="600" className="fill-ink">{cityName(o.deliveryCity, lang)}</text>
                  <g transform={`translate(${map.tx} ${map.ty})`}><circle r="13" className={ship.deliveredAt ? 'fill-ok' : 'fill-brand'} /><path d="M-6 -3h7v6h-7zM1 -1h3l2 2v2h-5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinejoin="round" /></g>
                </svg></div>
              )}
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div><div className="text-xs text-muted">{L('Dispatched', 'أُرسلت')}</div>{fmtDate(ship.dispatchedAt, lang, true)}</div>
                <div><div className="text-xs text-muted">{ship.deliveredAt ? L('Delivered', 'سُلّمت') : 'ETA'}</div><b>{fmtDate(ship.deliveredAt ?? ship.etaAt, lang, true)}</b></div>
                <div><div className="text-xs text-muted">{L('Distance · cost', 'المسافة · التكلفة')}</div>{roadKm(o.originCity, o.deliveryCity)} km · <Sar h={ship.costHalalas} lang={lang} /></div>
                <div><div className="text-xs text-muted">{L('Progress', 'التقدم')}</div><b className="num">{Math.round(progress * 100)}%</b></div>
              </div>
              {ship.podName && <div className="ok text-sm">{L('Proof of delivery', 'إثبات التسليم')}: {L('received by', 'استلمها')} <b>{ship.podName}</b>{ship.podNote && ` · ${ship.podNote}`}</div>}
            </section>
          )}

          <section className="card overflow-x-auto p-0">
            <div className="px-4 pt-4 font-semibold">{L('Lines', 'البنود')}</div>
            <table className="tbl mt-2" data-testid="order-lines">
              <thead><tr><th>#</th><th>{L('Item', 'الصنف')}</th><th>{L('Ordered', 'المطلوب')}</th><th>{L('Received', 'المستلم')}</th><th>{L('Accepted', 'المقبول')}</th><th>{L('Unit price', 'السعر')}</th><th>{L('Amount', 'المبلغ')}</th></tr></thead>
              <tbody>{lines.map((l) => (
                <tr key={l.id}><td className="num text-muted">{l.lineNo}</td><td><div className="font-medium">{l.item}</div><div className="text-xs text-muted">{l.spec}</div></td>
                  <td className="num">{fmtQty(l.qty)} {unitName(l.unit, lang)}</td>
                  <td className={`num ${l.receivedQty !== null && l.receivedQty < l.qty ? 'text-bad' : ''}`}>{l.receivedQty === null ? '—' : fmtQty(l.receivedQty)}</td>
                  <td className={`num ${l.acceptedQty !== null && l.receivedQty !== null && l.acceptedQty < l.receivedQty ? 'text-bad' : ''}`}>{l.acceptedQty === null ? '—' : fmtQty(l.acceptedQty)}</td>
                  <td><Sar h={l.unitHalalas} lang={lang} /></td><td><Sar h={lineTotal(l.qty, l.unitHalalas)} lang={lang} /></td></tr>))}</tbody>
              <tfoot>
                <tr><td colSpan={6} className="px-3 pt-2 text-end text-sm">{L('Subtotal', 'المجموع')}</td><td className="px-3 pt-2"><Sar h={o.subtotalHalalas} lang={lang} /></td></tr>
                <tr><td colSpan={6} className="px-3 text-end text-sm">{L('VAT 15%', 'ضريبة 15%')}</td><td className="px-3"><Sar h={o.vatHalalas} lang={lang} /></td></tr>
                <tr><td colSpan={6} className="px-3 pb-3 text-end font-semibold">{L('Total', 'الإجمالي')}</td><td className="px-3 pb-3 font-semibold"><Sar h={o.totalHalalas} lang={lang} /></td></tr>
              </tfoot>
            </table>
          </section>

          {qc && (
            <section className="card space-y-2" data-testid="qc-record">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{L('Quality inspection', 'فحص الجودة')}</div>
                <Pill tone={qc.decision === 'pass' ? 'ok' : qc.decision === 'partial' ? 'warn' : 'bad'}>{qc.decision === 'pass' ? L('Passed', 'مقبول') : qc.decision === 'partial' ? L('Partially accepted', 'قبول جزئي') : L('Rejected', 'مرفوض')}{qc.ncrNumber && ` · ${qc.ncrNumber}`}</Pill></div>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">{qc.checklist.map((c, i) => <li key={i} className={c.ok ? 'text-ink' : 'text-bad'}>{c.ok ? '✓' : '✗'} {c.label}</li>)}</ul>
              {qc.notes && <p className="text-sm text-muted">{qc.notes}</p>}
              <div className="text-xs text-muted">{qc.inspectorName} · {fmtDate(qc.createdAt, lang, true)}{d.qcs.length > 1 && ` · ${L(`${d.qcs.length} inspections in total`, `${d.qcs.length} فحوص إجمالاً`)}`}</div>
            </section>
          )}

          {inv && qr && (
            <section className="card" data-testid="einvoice">
              <div className="flex flex-wrap items-start gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="ZATCA QR" width={140} height={140} className="rounded-lg border border-line" data-testid="einvoice-qr" />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><b className="text-base">{L('Tax invoice', 'فاتورة ضريبية')} {inv.number}</b><StatusPill kind="invoice" status={inv.status} lang={lang} />{inv.autoPaid && <Pill tone="info">{L('Auto-paid', 'دفع تلقائي')}</Pill>}</div>
                  <div className="text-muted"><bdi>{o.supplierName}</bdi> → <bdi>{o.buyerName}</bdi> · {fmtDate(inv.issuedAt, lang, true)}</div>
                  <div className="num"><Sar h={inv.subtotalHalalas} lang={lang} /> + {L('VAT', 'الضريبة')} <Sar h={inv.vatHalalas} lang={lang} /> = <b><Sar h={inv.totalHalalas} lang={lang} /></b></div>
                  <div className="truncate font-mono text-[11px] text-muted" dir="ltr">UUID {inv.uuid}</div>
                  <div className="truncate font-mono text-[11px] text-muted" dir="ltr">Hash {inv.hash}</div>
                  {inv.paidAt && <div className="text-brand-ink">{L('Paid', 'دُفعت')} {fmtDate(inv.paidAt, lang, true)} · {inv.paymentRef}</div>}
                  {inv.match && !inv.match.ok && <div className="text-bad">{L('Match issues', 'مشاكل المطابقة')}: {inv.match.issues.join('; ')}</div>}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted">{L('Simplified ZATCA Phase 1 QR (seller, VAT number, time, total, VAT). Phase 2 clearance with the Fatoora portal needs your ZATCA onboarding credentials.', 'رمز QR للمرحلة الأولى (البائع، الرقم الضريبي، الوقت، الإجمالي، الضريبة). الربط في المرحلة الثانية مع منصة فاتورة يحتاج بيانات التسجيل لدى الهيئة.')}</p>
            </section>
          )}

          <section id="dispute" className="card space-y-3">
            <div className="font-semibold">{L('Disputes', 'النزاعات')}</div>
            {d.disputes.map((x) => (
              <div key={x.id} className="rounded-lg border border-line p-3 text-sm" data-testid={`dispute-${x.number}`}>
                <div className="flex flex-wrap items-center gap-2"><b>{x.number}</b><StatusPill kind="dispute" status={x.status} lang={lang} /><span className="text-xs text-muted">{DISPUTE_TYPES.find((t) => t.id === x.type)?.name[lang]} · {x.raisedByName} · {fmtDate(x.createdAt, lang, true)}</span></div>
                <p className="mt-1">{x.description}</p>
                {x.resolution ? <div className="ok mt-2">{L('Tawreed decision', 'قرار توريد')}: {x.resolution}</div> : <div className="mt-1 text-xs text-warn">{L('Tawreed will respond by', 'سترد توريد قبل')} {fmtDate(x.slaDueAt, lang, true)}</div>}
              </div>
            ))}
            {canDispute ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-bad" data-testid="dispute-toggle">{L('Raise a dispute', 'ارفع نزاعاً')}</summary>
                <form action={A.disputeAction} className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">{oid}
                  <label><span className="label">{L('Type', 'النوع')}</span><select name="type" className="input" data-testid="dispute-type">{DISPUTE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name[lang]}</option>)}</select></label>
                  <label><span className="label">{L('What happened?', 'ماذا حدث؟')}</span><input name="description" className="input" required minLength={5} data-testid="dispute-desc" /></label>
                  <button className="btn-danger" data-testid="dispute-submit">{L('Submit', 'إرسال')}</button>
                </form>
              </details>
            ) : !d.disputes.length && <p className="text-xs text-muted">{L('No disputes. You can raise one once goods are on the way.', 'لا توجد نزاعات. يمكن رفع نزاع بعد شحن البضاعة.')}</p>}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="card"><div className="mb-3 font-semibold">{L('Case progress', 'مراحل الطلب')}</div><Timeline steps={steps} /></section>
          <section className="card space-y-2 text-sm">
            <div className="font-semibold">{L('Parties', 'الأطراف')}</div>
            <div><div className="text-xs text-muted">{L('Buyer', 'المشتري')}</div><bdi>{o.buyerName}</bdi> · {cityName(o.deliveryCity, lang)}</div>
            <div><div className="text-xs text-muted">{L('Supplier', 'المورد')}</div><bdi>{o.supplierName}</bdi> · {cityName(o.originCity, lang)}</div>
            {o.docs?.deliveryNote && <div><div className="text-xs text-muted">{L('Delivery note', 'مذكرة التسليم')}</div>{o.docs.deliveryNote} · {o.docs.packages} {L('packages', 'طرود')}{o.docs.certificates && <div className="text-xs text-muted">{o.docs.certificates}</div>}</div>}
            {o.rating && <div><div className="text-xs text-muted">{L('Rating', 'التقييم')}</div><span className="text-warn">{'★'.repeat(o.rating)}</span>{o.ratingTags?.length ? <span className="text-xs text-muted"> · {o.ratingTags.map((t) => RATE_TAGS.find((x) => x.id === t)?.[lang] ?? t).join(', ')}</span> : null}</div>}
          </section>
          <section className="card"><div className="mb-3 font-semibold">{L('Live activity', 'النشاط المباشر')}</div><Activity events={d.events} lang={lang} empty="—" /></section>
        </aside>
      </div>
    </div>
  );
}
