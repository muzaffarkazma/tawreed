'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { withTenant, withSystem, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import * as S from '@/lib/ops/services';
import { OpsError, type Me } from '@/lib/ops/services';
import { structureRequirement, aiExplain, type DraftLine } from '@/lib/ops/structure';
import { scoreQuotes } from '@/lib/ops/matching';
import { CATEGORIES, UNITS, findCity, type Term } from '@/lib/ops/catalog';
import { sarIn } from '@/lib/ops/core';

async function me(): Promise<Me> {
  const u = await getCurrentUser();
  if (!u?.company || u.company.status !== 'active' || u.isPlatformAdmin) redirect('/login');
  return u as Me;
}
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const n = (fd: FormData, k: string) => Number(String(fd.get(k) ?? '').replace(',', '.'));
const isUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);
const term = (v: string): Term => (v === 'adv' || v === 'r30' ? v : 'nd');

/** Runs a business step; business errors come back to `back` as a readable message (in the user's language). */
async function step(back: string, fn: () => Promise<string | void>) {
  let err: string | null = null;
  let to: string | void = undefined;
  try { to = await fn(); } catch (e) {
    if (e instanceof OpsError) err = (await getLang()) === 'ar' ? e.ar : e.en; else throw e;
  }
  revalidatePath('/app', 'layout');
  if (err) redirect(`${back}${back.includes('?') ? '&' : '?'}err=${encodeURIComponent(err)}`);
  redirect(to || back);
}

// ---------------------------------------------------------------- requests
export interface StructureState { lines?: DraftLine[]; notes?: string[]; by?: string; error?: string; text?: string }
export async function structureAction(_p: StructureState, fd: FormData): Promise<StructureState> {
  const u = await me();
  const text = s(fd, 'description');
  if (text.length < 8) return { error: (await getLang()) === 'ar' ? 'صف احتياجك أولاً.' : 'Describe what you need first.', text };
  const index = await withSystem((tx) => S.loadIndex(tx));
  const r = await structureRequirement(text, index, s(fd, 'city') || u.company.city, { companyId: u.company.id, userId: u.id });
  if (!r.lines.length) return { error: (await getLang()) === 'ar' ? 'لم يتم العثور على بنود. اذكر الكمية ثم الصنف، مثل: 400 كيس أسمنت.' : 'No line items found. Write quantity then item, e.g. "400 bags of cement".', text };
  return { ...r, text };
}

export async function createRequestAction(fd: FormData) {
  const u = await me();
  let payload: { title: string; description: string; project: string; costCenter: string; city: string; needBy: string; by: string; lines: DraftLine[] };
  try { payload = JSON.parse(s(fd, 'payload')); } catch { redirect('/app/requests/new'); }
  const lines = (payload.lines ?? []).filter((l) => l.item?.trim() && Number(l.qty) > 0).map((l) => ({
    item: String(l.item).slice(0, 160), spec: String(l.spec ?? '').slice(0, 200), qty: Number(l.qty),
    unit: UNITS.some((x) => x.id === l.unit) ? l.unit : 'pcs', category: CATEGORIES.some((c) => c.id === l.category) ? l.category : 'other',
    indexKey: l.indexKey ?? null, estUnitHalalas: Math.max(0, Math.round(Number(l.estUnitHalalas) || 0))
  }));
  await step('/app/requests/new', async () => {
    if ((payload.title ?? '').trim().length < 3) throw new OpsError('Give the request a title.', 'اكتب عنواناً للطلب.');
    const id = await S.createRequest(u, { title: payload.title.trim().slice(0, 160), description: String(payload.description ?? '').slice(0, 6000), project: payload.project, costCenter: payload.costCenter, city: findCity(payload.city)?.id ?? u.company.city, needBy: payload.needBy, lines, by: payload.by || 'manual' });
    return `/app/requests/${id}?msg=created`;
  });
}

export async function cancelRequestAction(fd: FormData) {
  const u = await me(); const id = s(fd, 'requestId');
  await step(`/app/requests/${id}`, () => S.cancelRequest(u, id));
}

export async function triageAction(fd: FormData) {
  const u = await me(); const requestId = s(fd, 'requestId');
  if (!isUuid(requestId)) redirect('/app/requests');
  const picks = [...fd.keys()].filter((k) => k.startsWith('pick_')).map((k) => ({ lineId: k.slice(5), offerId: s(fd, k), term: term(s(fd, `term_${k.slice(5)}`)) })).filter((p) => isUuid(p.offerId));
  const next = s(fd, 'next');
  await step(`/app/requests/${requestId}`, async () => {
    if (next === 'market' && !picks.length) throw new OpsError('Tick at least one line to buy from the market.', 'اختر بنداً واحداً على الأقل للشراء من السوق.');
    await S.buyLinesFromMarket(u, requestId, picks);
    if (next === 'rfq') return `/app/rfqs/new?request=${requestId}`;
    return `/app/requests/${requestId}?msg=bought`;
  });
}

// ---------------------------------------------------------------- RFQs (buyer)
export async function createRfqAction(fd: FormData) {
  const u = await me(); const requestId = s(fd, 'requestId');
  await step(`/app/rfqs/new?request=${requestId}`, async () => {
    const id = await S.createRfq(u, { requestId, lineIds: fd.getAll('line').map(String).filter(isUuid), supplierIds: fd.getAll('sup').map(String).filter(isUuid), deadlineHours: Math.min(720, Math.max(1, n(fd, 'deadline') || 48)), terms: s(fd, 'terms').slice(0, 200) || 'DAP site, Net 30' });
    return `/app/rfqs/${id}?msg=published`;
  });
}
export async function closeBiddingAction(fd: FormData) { const u = await me(); const id = s(fd, 'rfqId'); await step(`/app/rfqs/${id}`, () => S.closeBidding(u, id)); }
export async function answerAction(fd: FormData) { const u = await me(); const id = s(fd, 'rfqId'); await step(`/app/rfqs/${id}`, () => S.answerQuestion(u, s(fd, 'questionId'), s(fd, 'answer').slice(0, 2000))); }
export async function discountAction(fd: FormData) { const u = await me(); const id = s(fd, 'rfqId'); await step(`/app/rfqs/${id}`, () => S.requestDiscount(u, s(fd, 'quoteId'), n(fd, 'pct'))); }
export async function awardAction(fd: FormData) {
  const u = await me(); const id = s(fd, 'rfqId');
  await step(`/app/rfqs/${id}`, async () => { const r = await S.awardQuote(u, id, s(fd, 'quoteId'), s(fd, 'justification').slice(0, 1000)); return `/app/rfqs/${id}?msg=${r}`; });
}
export async function approvalAction(fd: FormData) {
  const u = await me();
  await step('/app/approvals', async () => { await S.decideApproval(u, s(fd, 'approvalId'), s(fd, 'decision') === 'approve', s(fd, 'comment').slice(0, 1000)); return `/app/approvals?msg=${s(fd, 'decision')}`; });
}
export async function issuePoAction(fd: FormData) {
  const u = await me(); const id = s(fd, 'rfqId');
  await step(`/app/rfqs/${id}`, async () => `/app/orders/${await S.issuePo(u, id)}?msg=po`);
}

// ---------------------------------------------------------------- RFQs (supplier)
export async function askAction(fd: FormData) { const u = await me(); const id = s(fd, 'rfqId'); await step(`/app/opportunities/${id}`, () => S.askQuestion(u, id, s(fd, 'question').slice(0, 1000))); }
export async function declineInviteAction(fd: FormData) { const u = await me(); const id = s(fd, 'rfqId'); await step(`/app/opportunities/${id}`, () => S.declineInvite(u, id)); }
export async function respondDiscountAction(fd: FormData) { const u = await me(); const id = s(fd, 'rfqId'); await step(`/app/opportunities/${id}`, () => S.respondDiscount(u, s(fd, 'quoteId'), s(fd, 'accept') === '1')); }
export async function submitQuoteAction(fd: FormData) {
  const u = await me(); const id = s(fd, 'rfqId');
  const prices: Record<string, number> = {};
  for (const k of fd.keys()) if (k.startsWith('price_')) prices[k.slice(6)] = sarIn(s(fd, k) || 0);
  await step(`/app/opportunities/${id}`, async () => { await S.submitQuote(u, id, { leadDays: Math.round(n(fd, 'lead')), validDays: Math.round(n(fd, 'valid') || 30), notes: s(fd, 'notes').slice(0, 1000), prices }); return `/app/opportunities/${id}?msg=quoted`; });
}

// ---------------------------------------------------------------- market
export async function buyOfferAction(fd: FormData) {
  const u = await me();
  await step('/app/market', async () => `/app/orders/${await S.buyOffer(u, s(fd, 'offerId'), n(fd, 'qty'), term(s(fd, 'term')))}?msg=bought`);
}
export async function counterAction(fd: FormData) {
  const u = await me();
  await step('/app/market', async () => { await S.counterOffer(u, s(fd, 'offerId'), n(fd, 'qty'), term(s(fd, 'term')), sarIn(n(fd, 'price'))); return '/app/market?msg=countered'; });
}
export async function postOfferAction(fd: FormData) {
  const u = await me();
  const indexKey = s(fd, 'indexKey') || null;
  await step('/app/offers', async () => {
    const item = s(fd, 'item');
    if (item.length < 3) throw new OpsError('Enter the product name.', 'أدخل اسم المنتج.');
    await S.postOffer(u, {
      item: item.slice(0, 160), spec: s(fd, 'spec').slice(0, 200), category: CATEGORIES.some((c) => c.id === s(fd, 'category')) ? s(fd, 'category') : 'other', indexKey,
      unit: UNITS.some((x) => x.id === s(fd, 'unit')) ? s(fd, 'unit') : 'pcs', city: findCity(s(fd, 'city'))?.id ?? u.company.city,
      qty: n(fd, 'qty'), minQty: n(fd, 'min'), adv: sarIn(n(fd, 'adv')), nd: sarIn(n(fd, 'nd')), r30: sarIn(n(fd, 'r30')), leadDays: Math.max(1, Math.round(n(fd, 'lead') || 2)), validDays: Math.min(90, Math.max(1, Math.round(n(fd, 'valid') || 14)))
    });
    return '/app/offers?msg=posted';
  });
}
export async function offerStatusAction(fd: FormData) { const u = await me(); await step('/app/offers', () => S.setOfferStatus(u, s(fd, 'offerId'), s(fd, 'status') === 'paused' ? 'paused' : 'active')); }
export async function decideCounterAction(fd: FormData) {
  const u = await me();
  await step('/app/offers', async () => { const o = await S.decideCounter(u, s(fd, 'counterId'), s(fd, 'accept') === '1'); return o ? `/app/orders/${o}?msg=counter` : '/app/offers'; });
}

// ---------------------------------------------------------------- orders
const ob = (fd: FormData) => `/app/orders/${s(fd, 'orderId')}`;
export async function acceptOrderAction(fd: FormData) { const u = await me(); await step(ob(fd), () => S.acceptOrder(u, s(fd, 'orderId'))); }
export async function readyAction(fd: FormData) { const u = await me(); await step(ob(fd), () => S.markReady(u, s(fd, 'orderId'), { deliveryNote: s(fd, 'dn').slice(0, 60), packages: Math.max(1, Math.round(n(fd, 'packages') || 1)), certificates: s(fd, 'certs').slice(0, 300), notes: s(fd, 'notes').slice(0, 500) })); }
export async function dispatchAction(fd: FormData) { const u = await me(); await step(ob(fd), () => S.dispatchOrder(u, s(fd, 'orderId'), s(fd, 'carrier'))); }
export async function deliverAction(fd: FormData) { const u = await me(); await step(ob(fd), () => S.confirmDelivery(u, s(fd, 'orderId'), s(fd, 'podName').slice(0, 120), s(fd, 'podNote').slice(0, 500))); }
export async function receiptAction(fd: FormData) {
  const u = await me(); const rec: Record<string, number> = {};
  for (const k of fd.keys()) if (k.startsWith('rec_')) rec[k.slice(4)] = n(fd, k);
  await step(ob(fd), () => S.confirmReceipt(u, s(fd, 'orderId'), rec));
}
export async function qcAction(fd: FormData) {
  const u = await me(); const acc: Record<string, number> = {};
  for (const k of fd.keys()) if (k.startsWith('acc_')) acc[k.slice(4)] = n(fd, k);
  const labels = fd.getAll('chk_label').map(String);
  const checklist = labels.map((label, i) => ({ label: label.slice(0, 200), ok: fd.get(`chk_${i}`) === 'on' }));
  const decision = (['pass', 'partial', 'reject'].includes(s(fd, 'decision')) ? s(fd, 'decision') : 'pass') as 'pass' | 'partial' | 'reject';
  await step(ob(fd), () => S.qcDecision(u, s(fd, 'orderId'), { decision, checklist, accepted: acc, notes: s(fd, 'notes').slice(0, 1000) }));
}
export async function invoiceAction(fd: FormData) { const u = await me(); await step(ob(fd), async () => { await S.issueInvoice(u, s(fd, 'orderId')); }); }
export async function payAction(fd: FormData) { const u = await me(); await step(ob(fd), () => S.payInvoice(u, s(fd, 'orderId'), s(fd, 'ref').slice(0, 60))); }
export async function rateAction(fd: FormData) { const u = await me(); await step(ob(fd), () => S.rateOrder(u, s(fd, 'orderId'), Math.round(n(fd, 'stars')), fd.getAll('tag').map(String).slice(0, 6))); }
export async function disputeAction(fd: FormData) { const u = await me(); await step(ob(fd), async () => { await S.raiseDispute(u, s(fd, 'orderId'), s(fd, 'type'), s(fd, 'description').slice(0, 2000)); }); }

// ---------------------------------------------------------------- settings
export async function limitsAction(fd: FormData) {
  const u = await me();
  await step('/app/settings', async () => { await S.updateLimits(u, { threshold: sarIn(n(fd, 'threshold')), autoPay: sarIn(n(fd, 'autopay')), monthly: sarIn(n(fd, 'monthly')) }); return '/app/settings?msg=saved'; });
}
export async function supplierProfileAction(fd: FormData) {
  const u = await me();
  await step('/app/admin/company', async () => { await S.updateSupplierProfile(u, { categories: fd.getAll('cat').map(String).filter((c) => CATEGORIES.some((x) => x.id === c)), citiesServed: fd.getAll('city').map(String).filter((c) => !!findCity(c)), localContent: n(fd, 'lc') }); return '/app/admin/company?msg=profile'; });
}
export async function markNotificationsReadAction() {
  const u = await me();
  await withTenant(u.company.id, (tx) => tx.insert(schema.notificationReads).values({ userId: u.id, companyId: u.company.id, seenAt: new Date() }).onConflictDoUpdate({ target: schema.notificationReads.userId, set: { seenAt: new Date() } }));
  revalidatePath('/app', 'layout');
}

// ---------------------------------------------------------------- AI explanations (on demand)
export interface AskState { text?: string; provider?: string; error?: string }
export async function askAiAction(_p: AskState, fd: FormData): Promise<AskState> {
  const u = await me();
  const lang = await getLang();
  const kind = s(fd, 'kind'); const ref = s(fd, 'ref');
  if (!isUuid(ref)) return { error: 'Invalid reference' };
  const noAi = lang === 'ar' ? 'لا يوجد مزود ذكاء اصطناعي مُعدّ على المنصة. يعرض النظام الفحوص التلقائية فقط.' : 'No AI provider is configured on the platform yet, so only the automatic checks are shown.';
  const prompt = await withTenant(u.company.id, async (tx) => {
    if (kind === 'compare') {
      const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, ref));
      if (!rfq) return null;
      const qs = await tx.select().from(schema.quotes).where(eq(schema.quotes.rfqId, ref));
      const prof = await tx.select().from(schema.companyProfiles).where(inArray(schema.companyProfiles.companyId, qs.map((q) => q.supplierCompanyId).concat(['00000000-0000-0000-0000-000000000000'])));
      const rows = qs.map((q) => { const p = prof.find((x) => x.companyId === q.supplierCompanyId); return { id: q.id, supplierName: q.supplierName, supplierCompanyId: q.supplierCompanyId, totalHalalas: S.quoteNet(q), leadDays: q.leadDays, rating: p?.rating ?? 0, localContent: p?.localContent ?? 0, discountPct: q.discountPct }; });
      const sc = scoreQuotes(rows);
      return `RFQ ${rfq.number} "${rfq.title}", delivery ${rfq.deliveryCity}. Quotes (excl. VAT): ${sc.rows.map((r) => `${r.supplierName}: SAR ${(r.totalHalalas / 100).toFixed(0)}, lead ${r.leadDays} d, rating ${r.rating}, local content ${r.localContent}%, score ${r.score}`).join('; ')}. Explain which supplier to award and the main trade-off, and one negotiation tip.`;
    }
    if (kind === 'approval') {
      const [a] = await tx.select().from(schema.approvals).where(eq(schema.approvals.id, ref));
      if (!a) return null;
      const st = await S.getSettings(tx, u.company.id);
      const spend = await S.monthSpend(tx, u.company.id);
      return `Finance approval: award to ${a.supplierName}, SAR ${(a.amountHalalas / 100).toFixed(0)} incl. VAT. Approval threshold SAR ${(st.approvalThresholdHalalas / 100).toFixed(0)} excl. VAT. Spent this month SAR ${(spend / 100).toFixed(0)} of SAR ${(st.monthlyLimitHalalas / 100).toFixed(0)}. Procurement justification: "${a.justification}". Summarise the risk and what Finance should check before approving.`;
    }
    if (kind === 'qa') {
      const [q] = await tx.select().from(schema.rfqQuestions).where(eq(schema.rfqQuestions.id, ref));
      if (!q) return null;
      const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, q.rfqId));
      const lines = await tx.select().from(schema.rfqLines).where(eq(schema.rfqLines.rfqId, q.rfqId));
      return `Draft a short, factual answer to a supplier question on RFQ ${rfq.number}. Delivery: ${rfq.deliveryCity}, need by ${rfq.needBy ?? 'not set'}, terms: ${rfq.terms}. Lines: ${lines.map((l) => `${l.qty} ${l.unit} ${l.item} ${l.spec}`).join('; ')}. Question: "${q.question}". If the RFQ data does not answer it, say what the buyer will confirm.`;
    }
    return null;
  });
  if (!prompt) return { error: 'Not found' };
  const r = await aiExplain(`explain_${kind}`, prompt, { companyId: u.company.id, userId: u.id }, lang);
  return r ? { text: r.text, provider: r.provider } : { error: noAi };
}
