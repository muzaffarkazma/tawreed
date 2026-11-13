import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, isUuid, relTime } from '@/lib/ops/page';
import { quoteNet } from '@/lib/ops/services';
import { askAction, declineInviteAction, respondDiscountAction, submitQuoteAction } from '@/app/actions/ops';
import { CaseHead, fmtDual, AIBox, ActionPanel, Activity, Banner, Sar, StatusPill, TurnBar, WaitPanel, fmtDate } from '@/components/ops';
import { cityName, unitName } from '@/lib/ops/catalog';
import { QuoteBuilder } from './QuoteBuilder';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'supplier', perms: ['quote.submit'] });
  const { id } = await params; const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const d = await withTenant(me.company.id, async (tx) => {
    const [inv] = await tx.select().from(schema.rfqInvites).where(and(eq(schema.rfqInvites.rfqId, id), eq(schema.rfqInvites.supplierCompanyId, me.company.id)));
    if (!inv) return null;
    if (inv.status === 'invited') await tx.update(schema.rfqInvites).set({ status: 'viewed' }).where(eq(schema.rfqInvites.id, inv.id));
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, id));
    const lines = await tx.select().from(schema.rfqLines).where(eq(schema.rfqLines.rfqId, id)).orderBy(asc(schema.rfqLines.lineNo));
    const [quote] = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.rfqId, id), eq(schema.quotes.supplierCompanyId, me.company.id)));
    const qls = quote ? await tx.select().from(schema.quoteLines).where(eq(schema.quoteLines.quoteId, quote.id)) : [];
    const questions = await tx.select().from(schema.rfqQuestions).where(and(eq(schema.rfqQuestions.rfqId, id), eq(schema.rfqQuestions.supplierCompanyId, me.company.id))).orderBy(asc(schema.rfqQuestions.createdAt));
    const index = await tx.select().from(schema.priceIndex);
    const [order] = quote ? await tx.select().from(schema.orders).where(eq(schema.orders.quoteId, quote.id)) : [];
    const events = await tx.select().from(schema.caseEvents).where(and(eq(schema.caseEvents.refType, 'rfq'), eq(schema.caseEvents.refId, id), eq(schema.caseEvents.supplierCompanyId, me.company.id))).orderBy(desc(schema.caseEvents.id)).limit(20);
    return { inv, rfq, lines, quote, qls, questions, index, order, events };
  });
  if (!d || !d.rfq) notFound();
  const { rfq, quote } = d;
  const open = rfq.status === 'open' && rfq.deadline > new Date() && d.inv.status !== 'declined';
  const neg = quote?.negotiation;
  const builderLines = d.lines.map((l) => {
    const ix = d.index.find((x) => x.key === l.indexKey);
    return { id: l.id, lineNo: l.lineNo, item: l.item, spec: l.spec, qty: l.qty, unit: unitName(l.unit, lang), suggest: ix?.valueHalalas ?? l.estUnitHalalas, current: d.qls.find((q) => q.rfqLineId === l.id)?.unitHalalas ?? 0 };
  });
  const msg = sp.msg === 'quoted' ? L('Sealed quote submitted. You can update it until bidding closes.', 'قُدم العرض المختوم. يمكنك تعديله حتى الإغلاق.') : undefined;
  return (
    <div className="space-y-5">
      <AutoRefresh />
      <Banner err={sp.err} msg={msg} />
      {neg?.status === 'pending' && <TurnBar state="mine" title={L(`Your turn: the buyer asks for ${neg.targetPct}% off`, `دورك: المشتري يطلب خصم ${neg.targetPct}%`)} />}
      {!neg?.status && open && !quote && <TurnBar state="mine" title={L('Your turn: submit a sealed quote', 'دورك: قدّم عرضاً مختوماً')} sub={L(`Bidding closes ${relTime(rfq.deadline, lang)}.`, `يُغلق ${relTime(rfq.deadline, lang)}.`)} />}
      {open && quote && neg?.status !== 'pending' && <TurnBar state="other" title={L('Quote submitted. Waiting for bidding to close.', 'قُدم العرض. بانتظار الإغلاق.')} sub={L(`You can still revise it ${relTime(rfq.deadline, lang)}.`, `يمكنك تعديله ${relTime(rfq.deadline, lang)}.`)} />}
      {!open && quote?.status === 'submitted' && neg?.status !== 'pending' && <TurnBar state="other" title={L('Buyer is evaluating quotes', 'المشتري يقيّم العروض')} />}
      {quote?.status === 'awarded' && <TurnBar state="done" title={L('You won this RFQ', 'فزت بطلب العروض')} cta={d.order && <Link href={`/app/orders/${d.order.id}`} className="btn-pri btn-sm" data-testid="open-order">{L('Open purchase order', 'فتح أمر الشراء')} {d.order.number} →</Link>} />}
      {quote?.status === 'lost' && <TurnBar state="other" title={L('Awarded to another supplier', 'تمت الترسية على مورد آخر')} sub={L('Competitor prices are never shared.', 'أسعار المنافسين لا تُشارك أبداً.')} />}
      {d.inv.status === 'declined' && <TurnBar state="other" title={L('You declined this RFQ', 'اعتذرت عن هذا الطلب')} />}

      <CaseHead back={{ href: '/app/opportunities', label: L('Opportunities', 'الفرص') }} id={<>{rfq.number}{d.order && ` · ${d.order.number}`}</>} title={rfq.title}
        meta={<><bdi>{rfq.buyerName}</bdi> · {cityName(rfq.deliveryCity, lang)} · {rfq.terms}</>}
        status={quote ? <StatusPill kind="quote" status={quote.status} lang={lang} testId="quote-status" /> : <StatusPill kind="invite" status={d.inv.status === 'invited' ? 'viewed' : d.inv.status} lang={lang} />}
        facts={[
          [L('Match', 'المطابقة'), `${d.inv.matchScore}%`],
          [L('Your quote (excl. VAT)', 'عرضك (دون الضريبة)'), quote ? <Sar key="q" h={quoteNet(quote)} lang={lang} /> : '—'],
          [L('Bidding closes', 'إغلاق العروض'), fmtDate(rfq.deadline, lang, true)],
          [L('Need by', 'مطلوب بحلول'), rfq.needBy ? fmtDual(rfq.needBy, lang) : '—']
        ]}
        pct={quote?.status === 'awarded' ? 100 : quote ? 60 : 20} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {neg?.status === 'pending' && quote && (
            <ActionPanel lang={lang} title={L('Respond to price request', 'الرد على طلب خفض السعر')} testId="negotiation-panel"
              footer={<>
                <form action={respondDiscountAction}><input type="hidden" name="rfqId" value={rfq.id} /><input type="hidden" name="quoteId" value={quote.id} /><input type="hidden" name="accept" value="0" /><button className="btn-danger" data-testid="neg-decline">{L('Keep my price', 'أُبقي سعري')}</button></form>
                <form action={respondDiscountAction}><input type="hidden" name="rfqId" value={rfq.id} /><input type="hidden" name="quoteId" value={quote.id} /><input type="hidden" name="accept" value="1" /><button className="btn-pri" data-testid="neg-accept">{L(`Accept ${neg.targetPct}% off`, `قبول خصم ${neg.targetPct}%`)}</button></form>
              </>}>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div><div className="text-xs text-muted">{L('Your quote', 'عرضك')}</div><Sar h={quote.subtotalHalalas} lang={lang} className="font-semibold" /></div>
                <div><div className="text-xs text-muted">{L('Requested', 'المطلوب')}</div>−{neg.targetPct}%</div>
                <div><div className="text-xs text-muted">{L('New total', 'الإجمالي الجديد')}</div><Sar h={Math.round(quote.subtotalHalalas * (1 - neg.targetPct / 100))} lang={lang} className="font-semibold text-brand-ink" /></div>
              </div>
              <AIBox auto title={L('Context', 'سياق')}>{L('The buyer is comparing several sealed quotes. Accepting does not guarantee the award, but improves your price score (40% of the total).', 'المشتري يقارن عدة عروض مختومة. القبول لا يضمن الترسية لكنه يحسن درجة السعر (40% من الإجمالي).')}</AIBox>
            </ActionPanel>
          )}
          {open && (
            <form action={submitQuoteAction}>
              <input type="hidden" name="rfqId" value={rfq.id} />
              <ActionPanel lang={lang} title={quote ? L('Revise your sealed quote', 'عدّل عرضك المختوم') : L('Build your quote', 'جهّز عرضك')} testId="quote-panel"
                footer={<><button className="btn-pri" data-testid="submit-quote">{quote ? L('Update quote', 'تحديث العرض') : L('Submit sealed quote', 'تقديم العرض المختوم')}</button></>}>
                <QuoteBuilder lang={lang} lines={builderLines} lead={quote?.leadDays ?? 3} valid={quote?.validDays ?? 30} notes={quote?.notes ?? ''} />
              </ActionPanel>
            </form>
          )}
          {!open && quote && (
            <section className="card overflow-x-auto p-0">
              <div className="px-4 pt-4 font-semibold">{L('Your submitted quote', 'عرضك المقدم')}</div>
              <table className="tbl mt-2"><thead><tr><th>{L('Item', 'الصنف')}</th><th>{L('Qty', 'الكمية')}</th><th>{L('Unit price', 'سعر الوحدة')}</th></tr></thead>
                <tbody>{builderLines.map((l) => <tr key={l.id}><td>{l.item}</td><td className="num">{l.qty} {l.unit}</td><td><Sar h={l.current} lang={lang} /></td></tr>)}</tbody>
                <tfoot><tr><td colSpan={2} className="px-3 py-2 text-end">{L('Total excl. VAT', 'الإجمالي دون الضريبة')}{quote.discountPct > 0 && ` (−${quote.discountPct}%)`}</td><td className="px-3 font-semibold"><Sar h={quoteNet(quote)} lang={lang} /></td></tr></tfoot></table>
            </section>
          )}
          {open && !quote && d.inv.status !== 'declined' && <form action={declineInviteAction}><input type="hidden" name="rfqId" value={rfq.id} /><button className="btn btn-sm" data-testid="decline">{L('Decline to quote', 'الاعتذار عن التقديم')}</button></form>}

          <section className="card space-y-3">
            <div className="font-semibold">{L('Questions and clarifications', 'الأسئلة والتوضيحات')}</div>
            {!d.questions.length && <p className="text-sm text-muted">{L('Ask the buyer about specs, delivery or terms. Answers are shared with every bidder.', 'اسأل المشتري عن المواصفات أو التسليم أو الشروط. تُشارك الإجابات مع جميع المتقدمين.')}</p>}
            {d.questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-line p-3 text-sm" data-testid="question">
                <div className="text-xs text-muted">{q.supplierName === 'Shared clarification' ? L('Clarification shared with all bidders', 'توضيح مشترك لجميع المتقدمين') : L('Your question', 'سؤالك')} · {fmtDate(q.createdAt, lang, true)}</div>
                <div className="mt-1 font-medium">{q.question}</div>
                {q.answer ? <div className="mt-2 rounded-md bg-brand-soft px-3 py-2 text-brand-ink" data-testid="answer">{q.answer}</div> : <div className="mt-1 text-xs text-warn">{L('Waiting for the buyer', 'بانتظار المشتري')}</div>}
              </div>
            ))}
            {open && <form action={askAction} className="flex gap-2"><input type="hidden" name="rfqId" value={rfq.id} /><input name="question" className="input" required minLength={3} placeholder={L('Ask a question…', 'اطرح سؤالاً…')} data-testid="ask-question" /><button className="btn" data-testid="ask-send">{L('Send', 'إرسال')}</button></form>}
          </section>
          {!open && !quote && d.inv.status !== 'declined' && <WaitPanel>{L('Bidding has closed. You did not submit a quote.', 'أُغلقت العروض ولم تقدم عرضاً.')}</WaitPanel>}
        </div>
        <aside className="space-y-5">
          <section className="card text-sm"><div className="mb-2 font-semibold">{L('Why you were invited', 'سبب دعوتك')}</div><p className="text-muted">{(d.inv.matchReason.split('\n')[lang === 'ar' ? 1 : 0]) || d.inv.matchReason}</p><div className="mt-2 text-xs">{L('Match score', 'درجة المطابقة')}: <b className="num">{d.inv.matchScore}</b></div></section>
          <section className="card"><div className="mb-3 font-semibold">{L('Activity', 'النشاط')}</div><Activity events={d.events} lang={lang} empty="—" /></section>
        </aside>
      </div>
    </div>
  );
}
