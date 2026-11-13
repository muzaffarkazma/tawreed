import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, isUuid, relTime, ZERO } from '@/lib/ops/page';
import { autoCloseRfq, quoteNet, getSettings } from '@/lib/ops/services';
import { scoreQuotes, recommendationText, pctVs } from '@/lib/ops/matching';
import { vatOf } from '@/lib/ops/core';
import { awardAction, closeBiddingAction, discountAction, issuePoAction } from '@/app/actions/ops';
import { CaseHead, fmtDual, AIBox, ActionPanel, Activity, Banner, Sar, StatusPill, Timeline, TurnBar, WaitPanel, fmtDate, fmtQty, Pill } from '@/components/ops';
import { AskAI } from '@/components/AskAI';
import { AnswerForm } from '@/components/AnswerForm';
import { cityName, unitName } from '@/lib/ops/catalog';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function RfqPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['rfq.manage'] });
  const { id } = await params; const sp = await searchParams;
  if (!isUuid(id)) notFound();
  await autoCloseRfq(id, me.company.id);
  const d = await withTenant(me.company.id, async (tx) => {
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, id));
    if (!rfq) return null;
    const [lines, invites, quotes, questions, events, approvals, orders, settings] = await Promise.all([
      tx.select().from(schema.rfqLines).where(eq(schema.rfqLines.rfqId, id)).orderBy(asc(schema.rfqLines.lineNo)),
      tx.select().from(schema.rfqInvites).where(eq(schema.rfqInvites.rfqId, id)).orderBy(desc(schema.rfqInvites.matchScore)),
      tx.select().from(schema.quotes).where(eq(schema.quotes.rfqId, id)),
      tx.select().from(schema.rfqQuestions).where(and(eq(schema.rfqQuestions.rfqId, id), ne(schema.rfqQuestions.supplierName, 'Shared clarification'))).orderBy(asc(schema.rfqQuestions.createdAt)),
      tx.select().from(schema.caseEvents).where(and(eq(schema.caseEvents.refType, 'rfq'), eq(schema.caseEvents.refId, id))).orderBy(desc(schema.caseEvents.id)).limit(40),
      tx.select().from(schema.approvals).where(eq(schema.approvals.rfqId, id)).orderBy(desc(schema.approvals.createdAt)),
      tx.select().from(schema.orders).where(eq(schema.orders.rfqId, id)),
      getSettings(tx, me.company.id)
    ]);
    const qls = await tx.select().from(schema.quoteLines).where(inArray(schema.quoteLines.quoteId, quotes.map((q) => q.id).concat([ZERO])));
    const profiles = await tx.select().from(schema.companyProfiles).where(inArray(schema.companyProfiles.companyId, quotes.map((q) => q.supplierCompanyId).concat([ZERO])));
    const index = await tx.select().from(schema.priceIndex);
    return { rfq, lines, invites, quotes, qls, profiles, questions, events, approvals, orders, settings, index };
  });
  if (!d) notFound();
  const { rfq, lines } = d;
  const sealed = rfq.status === 'open';
  const est = lines.reduce((s, l) => s + Math.round(l.qty * l.estUnitHalalas), 0);
  const sc = scoreQuotes(d.quotes.map((q) => { const p = d.profiles.find((x) => x.companyId === q.supplierCompanyId); return { id: q.id, supplierName: q.supplierName, supplierCompanyId: q.supplierCompanyId, totalHalalas: quoteNet(q), leadDays: q.leadDays, rating: p?.rating ?? 0, localContent: p?.localContent ?? 0, discountPct: q.discountPct }; }));
  const unit = (qid: string, lid: string) => d.qls.find((x) => x.quoteId === qid && x.rfqLineId === lid)?.unitHalalas ?? 0;
  const bestPerLine = (lid: string) => Math.min(...d.quotes.map((q) => Math.round(unit(q.id, lid) * (1 - q.discountPct / 100))));
  const order = d.orders[0];
  const approval = d.approvals[0];
  const awarded = d.quotes.find((q) => q.id === rfq.awardedQuoteId);
  const openQs = d.questions.filter((q) => !q.answer);
  const st = rfq.status;
  const idx = ['open', 'evaluation', 'pending_approval', 'approved', 'ordered'].indexOf(st);
  const steps = [
    { label: L('Published to matched suppliers', 'نُشر للموردين المطابقين'), done: true, now: false, who: fmtDate(rfq.createdAt, lang, true) },
    { label: L('Sealed bidding', 'العروض المختومة'), done: idx > 0, now: idx === 0, side: 'supplier' as const, who: `${d.quotes.length}/${d.invites.length} ${L('quoted', 'قدموا')}` },
    { label: L('Compare and award', 'المقارنة والترسية'), done: idx > 1, now: idx === 1, who: L('Procurement', 'المشتريات'), role: 'procurement' },
    { label: L('Finance approval', 'الاعتماد المالي'), done: idx > 2, now: idx === 2, role: 'finance', who: approval ? (approval.status === 'pending' ? L('pending', 'بانتظار') : approval.status) : L('only above threshold', 'فقط فوق الحد') },
    { label: L('Purchase order issued', 'صدر أمر الشراء'), done: idx >= 4, now: idx === 3, who: order?.number ?? L('Procurement', 'المشتريات'), role: 'procurement' }
  ];
  const msg = sp.msg === 'published' ? L('RFQ published. Matched suppliers have been notified.', 'نُشر طلب العروض وأُبلغ الموردون.') : sp.msg === 'approval' ? L('Award sent to Finance for approval (above your approval threshold).', 'أُرسلت الترسية للمالية للاعتماد (أعلى من حد الاعتماد).') : sp.msg === 'approved' ? L('Award approved automatically (below threshold). Issue the PO.', 'اعتُمدت الترسية تلقائياً (أقل من الحد). أصدر أمر الشراء.') : undefined;
  return (
    <div className="space-y-5">
      <AutoRefresh />
      <Banner err={sp.err} msg={msg} />
      {st === 'open' && <TurnBar state="wait" title={L(`Bidding open · ${d.quotes.length} of ${d.invites.length} suppliers have quoted`, `استقبال العروض · ${d.quotes.length} من ${d.invites.length} موردين قدموا`)} sub={L(`Quotes stay sealed until bidding closes ${relTime(rfq.deadline, lang)}.`, `تبقى العروض مختومة حتى الإغلاق ${relTime(rfq.deadline, lang)}.`)}
        cta={<form action={closeBiddingAction}><input type="hidden" name="rfqId" value={rfq.id} /><button className="btn btn-sm" data-testid="close-bidding">{L('Close bidding now', 'أغلق العروض الآن')}</button></form>} />}
      {st === 'evaluation' && <TurnBar state="mine" title={L('Your turn: compare quotes and award', 'دورك: قارن العروض وقم بالترسية')} sub={L('Tawreed scored each quote: price 40, lead time 25, rating 20, local content 15.', 'قيّمت توريد كل عرض: السعر 40، مدة التوريد 25، التقييم 20، المحتوى المحلي 15.')} />}
      {st === 'pending_approval' && <TurnBar state="other" title={L('Waiting on Finance approval', 'بانتظار اعتماد المالية')} sub={awarded && L(`Award to ${awarded.supplierName} is above your approval threshold.`, `الترسية على ${awarded.supplierName} أعلى من حد الاعتماد.`)} />}
      {st === 'approved' && <TurnBar state="mine" title={L('Your turn: issue the purchase order', 'دورك: أصدر أمر الشراء')} sub={awarded && `${awarded.supplierName} · ${(quoteNet(awarded) / 100).toLocaleString('en-US')} ${L('SAR excl. VAT', 'ر.س دون الضريبة')}`} />}
      {st === 'ordered' && order && <TurnBar state="done" title={L(`Purchase order ${order.number} issued`, `صدر أمر الشراء ${order.number}`)} cta={<Link href={`/app/orders/${order.id}`} className="btn-pri btn-sm" data-testid="open-order">{L('Open order', 'فتح الطلب')} →</Link>} />}

      <CaseHead back={{ href: '/app/rfqs', label: L('RFQs', 'طلبات العروض') }} id={<>{rfq.number}{order && ` · ${order.number}`}</>} title={rfq.title}
        meta={<><bdi>{rfq.buyerName}</bdi> · {cityName(rfq.deliveryCity, lang)} · {rfq.terms}</>}
        status={<StatusPill kind="rfq" status={st} lang={lang} testId="rfq-status" />}
        facts={[
          [awarded ? L('Awarded value (excl. VAT)', 'قيمة الترسية (دون الضريبة)') : L('Estimated budget (excl. VAT)', 'الميزانية التقديرية (دون الضريبة)'), <Sar key="v" h={awarded ? quoteNet(awarded) : est} lang={lang} />],
          [L('Supplier', 'المورد'), awarded ? <bdi key="s">{awarded.supplierName}</bdi> : `${d.quotes.length}/${d.invites.length} ${L('quoted', 'قدموا')}`],
          [L('Bidding closes', 'إغلاق العروض'), fmtDate(rfq.deadline, lang, true)],
          [L('Need by', 'مطلوب بحلول'), rfq.needBy ? fmtDual(rfq.needBy, lang) : '—']
        ]}
        pct={(Math.max(0, idx) + 1) / 5 * 100} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {st === 'approved' && (
            <form action={issuePoAction}><input type="hidden" name="rfqId" value={rfq.id} />
              <ActionPanel lang={lang} title={L('Issue purchase order', 'إصدار أمر الشراء')} footer={<button className="btn-pri" data-testid="issue-po">{L('Issue PO to', 'إصدار أمر الشراء إلى')} {awarded?.supplierName}</button>}>
                <p className="text-sm">{L('The PO is sent to the supplier with your prices, quantities and terms. Losing bidders are told the RFQ was awarded elsewhere (prices are never shared).', 'يُرسل أمر الشراء للمورد بالأسعار والكميات والشروط. يُبلغ الموردون الآخرون بأن الترسية تمت لغيرهم (دون مشاركة الأسعار).')}</p>
                {awarded && <div className="num text-sm">{L('Total', 'الإجمالي')}: <Sar h={quoteNet(awarded)} lang={lang} /> + {L('VAT', 'الضريبة')} <Sar h={vatOf(quoteNet(awarded))} lang={lang} /> = <b><Sar h={quoteNet(awarded) + vatOf(quoteNet(awarded))} lang={lang} /></b></div>}
              </ActionPanel>
            </form>
          )}

          {sealed ? (
            <section className="card">
              <div className="flex items-center gap-2 font-semibold"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" /></svg>{L('Sealed quotes', 'العروض المختومة')}</div>
              <p className="mt-1 text-sm text-muted">{L('Prices are hidden from everyone, including you, until bidding closes. This keeps bidding fair.', 'الأسعار مخفية عن الجميع، بما فيهم أنت، حتى الإغلاق. هذا يضمن عدالة المنافسة.')}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="invites">
                {d.invites.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm"><span><bdi>{i.supplierName}</bdi> <span className="text-xs text-muted">· {L('match', 'مطابقة')} {i.matchScore}</span></span><StatusPill kind="invite" status={i.status} lang={lang} /></li>)}
              </ul>
            </section>
          ) : sc.rows.length > 0 && (
            <>
              {sc.best && sc.cheapest && (
                <AIBox title={L('Recommendation', 'التوصية')} testId="recommendation" by={L('Tawreed scoring', 'تقييم توريد')}>
                  {recommendationText(sc.best, sc.cheapest, est, lang)}
                  <div className="mt-2"><AskAI kind="compare" refId={rfq.id} label={L('Ask AI to explain the trade-off', 'اطلب من الذكاء الاصطناعي شرح المفاضلة')} title={L('AI explanation', 'شرح الذكاء الاصطناعي')} busy={L('Thinking…', 'جارٍ التفكير…')} /></div>
                </AIBox>
              )}
              <section className="card overflow-x-auto p-0">
                <div className="px-4 pt-4 font-semibold">{L('Comparison', 'المقارنة')}</div>
                <table className="tbl mt-2 min-w-[640px]" data-testid="compare">
                  <thead><tr><th>{L('Line', 'البند')}</th><th>{L('Index', 'المؤشر')}</th>{sc.rows.map((q) => <th key={q.id} className={q.id === sc.best?.id ? 'bg-brand-soft text-brand-ink' : ''}><bdi>{q.supplierName}</bdi>{q.id === sc.best?.id && <div className="text-[10.5px]">★ {L('recommended', 'موصى به')}</div>}</th>)}</tr></thead>
                  <tbody>
                    {lines.map((l) => {
                      const ix = d.index.find((x) => x.key === l.indexKey);
                      const best = bestPerLine(l.id);
                      return (
                        <tr key={l.id}>
                          <td><div className="font-medium">{l.item}</div><div className="num text-xs text-muted">{fmtQty(l.qty)} {unitName(l.unit, lang)}</div></td>
                          <td className="text-xs">{ix ? <Sar h={ix.valueHalalas} lang={lang} /> : '—'}</td>
                          {sc.rows.map((q) => {
                            const quote = d.quotes.find((x) => x.id === q.id)!;
                            const u = Math.round(unit(q.id, l.id) * (1 - quote.discountPct / 100));
                            const vs = ix ? pctVs(u, ix.valueHalalas) : null;
                            return <td key={q.id} className={u === best ? 'bg-ok-soft' : ''}><Sar h={u} lang={lang} />{vs !== null && <div className={`text-[10.5px] ${vs <= 0 ? 'text-ok' : 'text-bad'}`}>{vs > 0 ? '+' : ''}{vs.toFixed(1)}%</div>}</td>;
                          })}
                        </tr>
                      );
                    })}
                    <tr className="font-semibold"><td>{L('Total excl. VAT', 'الإجمالي دون الضريبة')}</td><td className="text-xs font-normal text-muted"><Sar h={est} lang={lang} /> {L('est.', 'تقدير')}</td>{sc.rows.map((q) => <td key={q.id} data-testid={`total-${q.supplierName}`}><Sar h={q.totalHalalas} lang={lang} />{q.discountPct > 0 && <div className="text-[10.5px] font-normal text-ok">−{q.discountPct}% {L('negotiated', 'بعد التفاوض')}</div>}</td>)}</tr>
                    <tr><td>{L('Lead time', 'مدة التوريد')}</td><td />{sc.rows.map((q) => <td key={q.id} className="num">{q.leadDays} {L('days', 'أيام')}</td>)}</tr>
                    <tr><td>{L('Rating', 'التقييم')}</td><td />{sc.rows.map((q) => <td key={q.id} className="num">★ {q.rating.toFixed(1)}</td>)}</tr>
                    <tr><td>{L('Local content', 'المحتوى المحلي')}</td><td />{sc.rows.map((q) => <td key={q.id} className="num">{q.localContent}%</td>)}</tr>
                    <tr><td>{L('Notes', 'ملاحظات')}</td><td />{sc.rows.map((q) => <td key={q.id} className="max-w-[180px] text-xs text-muted">{d.quotes.find((x) => x.id === q.id)?.notes || '—'}</td>)}</tr>
                    <tr className="bg-sunk"><td className="font-semibold">{L('Score', 'الدرجة')}</td><td />{sc.rows.map((q) => <td key={q.id} className="num text-lg font-semibold" data-testid={`score-${q.supplierName}`}>{q.score}</td>)}</tr>
                    {st === 'evaluation' && (
                      <tr><td className="text-xs text-muted">{L('Negotiate', 'تفاوض')}</td><td />{sc.rows.map((q) => {
                        const quote = d.quotes.find((x) => x.id === q.id)!;
                        const n = quote.negotiation;
                        return <td key={q.id}>{n?.status === 'pending' ? <Pill tone="warn">{L(`Asked −${n.targetPct}%`, `طُلب −${n.targetPct}%`)}</Pill> : n ? <Pill tone={n.status === 'accepted' ? 'ok' : 'bad'}>{n.status === 'accepted' ? L(`Accepted −${n.targetPct}%`, `قُبل −${n.targetPct}%`) : L('Declined', 'رُفض')}</Pill> : (
                          <form action={discountAction} className="flex items-center gap-1"><input type="hidden" name="rfqId" value={rfq.id} /><input type="hidden" name="quoteId" value={q.id} />
                            <input name="pct" className="input w-16 px-2 py-1 text-xs" defaultValue="3" inputMode="decimal" aria-label="%" />%<button className="btn btn-sm px-2" data-testid={`discount-${q.supplierName}`}>{L('Ask', 'اطلب')}</button></form>)}</td>;
                      })}</tr>
                    )}
                  </tbody>
                </table>
              </section>
              {st === 'evaluation' && (
                <form action={awardAction}><input type="hidden" name="rfqId" value={rfq.id} />
                  <ActionPanel lang={lang} title={L('Award', 'الترسية')} testId="award-panel" footer={<button className="btn-pri" data-testid="award">{L('Award', 'ترسية')}</button>}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sc.rows.map((q) => (
                        <label key={q.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft" data-testid={`award-${q.supplierName}`}>
                          <input type="radio" name="quoteId" value={q.id} defaultChecked={q.id === sc.best?.id} className="accent-brand" />
                          <span className="flex-1"><b><bdi>{q.supplierName}</bdi></b><div className="text-xs text-muted"><Sar h={q.totalHalalas} lang={lang} /> · {q.leadDays} {L('days', 'أيام')} · {L('score', 'الدرجة')} {q.score}</div></span>
                        </label>
                      ))}
                    </div>
                    <label className="block"><span className="label">{L('Justification (shown to Finance)', 'المبرر (يظهر للمالية)')}</span>
                      <textarea name="justification" className="input min-h-[60px]" defaultValue={sc.best && sc.cheapest ? recommendationText(sc.best, sc.cheapest, est, lang) : ''} /></label>
                    <p className="text-xs text-muted">{L('Awards above', 'الترسيات الأعلى من')} <Sar h={d.settings.approvalThresholdHalalas} lang={lang} /> {L('excl. VAT go to Finance for approval; smaller awards are approved automatically.', 'دون الضريبة تذهب للمالية للاعتماد؛ والأصغر تُعتمد تلقائياً.')}</p>
                  </ActionPanel>
                </form>
              )}
              {st === 'pending_approval' && <WaitPanel>{L('Finance has been notified. You will be able to issue the PO once they approve.', 'أُبلغت المالية. ستتمكن من إصدار أمر الشراء بعد الاعتماد.')}</WaitPanel>}
              {rfq.awardNote && st === 'evaluation' && rfq.awardNote.startsWith('Returned') && <div className="err">{rfq.awardNote}</div>}
            </>
          )}

          <section className="card space-y-3">
            <div className="font-semibold">{L('Supplier questions', 'أسئلة الموردين')} {openQs.length > 0 && <span className="pill-warn ms-1">{openQs.length}</span>}</div>
            {!d.questions.length && <p className="text-sm text-muted">{L('No questions yet. Answers are shared with every invited supplier.', 'لا توجد أسئلة بعد. تُشارك الإجابات مع جميع الموردين المدعوين.')}</p>}
            {d.questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-line p-3 text-sm" data-testid="question">
                <div className="text-xs text-muted"><bdi>{q.supplierName}</bdi> · {fmtDate(q.createdAt, lang, true)}</div>
                <div className="mt-1 font-medium">{q.question}</div>
                {q.answer ? <div className="mt-2 rounded-md bg-brand-soft px-3 py-2 text-brand-ink">{q.answer} <span className="text-xs opacity-75">· {L('shared with all bidders', 'شوركت مع الجميع')}</span></div>
                  : st === 'open' ? <div className="mt-2"><AnswerForm rfqId={rfq.id} questionId={q.id} t={{ placeholder: L('Your answer (shared with all bidders)', 'إجابتك (تُشارك مع جميع المتقدمين)'), send: L('Send answer', 'إرسال الإجابة'), draft: L('Draft with AI', 'صياغة بالذكاء الاصطناعي'), busy: '…' }} /></div> : null}
              </div>
            ))}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="card"><div className="mb-3 font-semibold">{L('Progress', 'المراحل')}</div><Timeline steps={steps} /></section>
          <section className="card"><div className="mb-2 font-semibold">{L('Lines', 'البنود')}</div>
            <ul className="space-y-1.5 text-xs">{lines.map((l) => <li key={l.id} className="flex justify-between gap-2"><span>{l.item}</span><span className="num text-muted">{fmtQty(l.qty)} {unitName(l.unit, lang)}</span></li>)}</ul>
            <div className="mt-2 border-t border-line pt-2 text-xs text-muted">{L('Estimate', 'التقدير')}: <Sar h={est} lang={lang} /></div></section>
          <section className="card"><div className="mb-3 font-semibold">{L('Live activity', 'النشاط المباشر')}</div><Activity events={d.events} lang={lang} empty="—" /></section>
        </aside>
      </div>
    </div>
  );
}
