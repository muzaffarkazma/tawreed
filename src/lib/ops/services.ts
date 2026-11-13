import 'server-only';
import { and, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { withTenant, withSystem, schema, type Tx } from '@/db';
import type { CurrentUser } from '@/lib/auth';
import { can, nextNo, logEvent, Outbox, actorOf, vatOf, lineTotal, rolesFor, type Actor } from './core';
import { matchSuppliers, type Profile } from './matching';
import { carrierQuotes, type Term, DISPUTE_TYPES } from './catalog';
import { zatcaQr, invoiceIdentity } from './zatca';
import type { DraftLine, IndexRow } from './structure';

export type Me = CurrentUser & { company: NonNullable<CurrentUser['company']> };
export class OpsError extends Error { constructor(public en: string, public ar: string) { super(en); } }
const deny = () => new OpsError('You do not have permission for this action.', 'لا تملك صلاحية تنفيذ هذا الإجراء.');
const stale = () => new OpsError('This item was already updated by someone else. The page has been refreshed.', 'تم تحديث هذا العنصر من شخص آخر. تم تحديث الصفحة.');
function need(me: Me, perm: string) { if (!can(me, perm)) throw deny(); }

// ---------------------------------------------------------------- shared helpers
export async function getSettings(tx: Tx, companyId: string) {
  const [s] = await tx.select().from(schema.companySettings).where(eq(schema.companySettings.companyId, companyId));
  if (s) return s;
  const [n] = await tx.insert(schema.companySettings).values({ companyId }).onConflictDoNothing().returning();
  return n ?? (await tx.select().from(schema.companySettings).where(eq(schema.companySettings.companyId, companyId)))[0];
}

export async function monthSpend(tx: Tx, buyerId: string) {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const r = await tx.select({ s: sql<number>`coalesce(sum(${schema.orders.totalHalalas}),0)`.mapWith(Number) }).from(schema.orders)
    .where(and(eq(schema.orders.buyerCompanyId, buyerId), gte(schema.orders.createdAt, start), ne(schema.orders.status, 'cancelled')));
  return r[0]?.s ?? 0;
}

async function checkLimit(tx: Tx, buyerId: string, addHalalas: number) {
  const s = await getSettings(tx, buyerId);
  const used = await monthSpend(tx, buyerId);
  if (used + addHalalas > s.monthlyLimitHalalas) {
    const left = Math.max(0, s.monthlyLimitHalalas - used) / 100;
    throw new OpsError(`This exceeds the monthly purchase limit. Available: SAR ${left.toLocaleString('en-US')}. Ask Finance to raise it.`,
      `هذا يتجاوز حد الشراء الشهري. المتاح: ${left.toLocaleString('en-US')} ر.س. اطلب من المالية رفعه.`);
  }
}

export async function loadIndex(tx: Tx): Promise<IndexRow[]> {
  return tx.select({ key: schema.priceIndex.key, category: schema.priceIndex.category, city: schema.priceIndex.city, keywords: schema.priceIndex.keywords, valueHalalas: schema.priceIndex.valueHalalas, itemEn: schema.priceIndex.itemEn, unitEn: schema.priceIndex.unitEn }).from(schema.priceIndex);
}

/** Every trade nudges the benchmark: 90% previous value, 10% new price (unless an admin pinned it). */
async function feedIndex(tx: Tx, key: string | null, unitHalalas: number) {
  if (!key) return;
  const [r] = await tx.select().from(schema.priceIndex).where(eq(schema.priceIndex.key, key));
  if (!r || r.overridden) return;
  const v = Math.round(r.valueHalalas * 0.9 + unitHalalas * 0.1);
  const hist = [...(r.history ?? []), v].slice(-12);
  await tx.update(schema.priceIndex).set({ valueHalalas: v, history: hist, sourceCount: r.sourceCount + 1, changePct: hist[0] ? Math.round(((v - hist[0]) / hist[0]) * 1000) / 10 : 0, updatedAt: new Date() }).where(eq(schema.priceIndex.key, key));
}

async function profile(tx: Tx, companyId: string) {
  const [p] = await tx.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.companyId, companyId));
  return p;
}

interface NewLine { item: string; spec: string; unit: string; indexKey: string | null; qty: number; unitHalalas: number }
async function createOrderTx(tx: Tx, o: {
  kind: 'po' | 'market'; buyerId: string; buyerName: string; supplierId: string; supplierName: string; term: Term; deliveryCity: string; originCity: string;
  leadDays: number; status: 'issued' | 'accepted'; lines: NewLine[]; createdBy: string; requestId?: string | null; rfqId?: string | null; quoteId?: string | null; offerId?: string | null;
}) {
  const subtotal = o.lines.reduce((s, l) => s + lineTotal(l.qty, l.unitHalalas), 0);
  const vat = vatOf(subtotal);
  const number = await nextNo(tx, o.kind === 'po' ? 'po_seq' : 'mo_seq', o.kind === 'po' ? 'PO' : 'MO');
  const [ord] = await tx.insert(schema.orders).values({
    number, kind: o.kind, buyerCompanyId: o.buyerId, buyerName: o.buyerName, supplierCompanyId: o.supplierId, supplierName: o.supplierName,
    requestId: o.requestId ?? null, rfqId: o.rfqId ?? null, quoteId: o.quoteId ?? null, offerId: o.offerId ?? null,
    paymentTerm: o.term, deliveryCity: o.deliveryCity, originCity: o.originCity, leadDays: o.leadDays, status: o.status,
    subtotalHalalas: subtotal, vatHalalas: vat, totalHalalas: subtotal + vat, createdBy: o.createdBy
  }).returning();
  await tx.insert(schema.orderLines).values(o.lines.map((l, i) => ({
    orderId: ord.id, buyerCompanyId: o.buyerId, supplierCompanyId: o.supplierId, lineNo: i + 1,
    item: l.item, spec: l.spec, unit: l.unit, indexKey: l.indexKey, qty: l.qty, unitHalalas: l.unitHalalas
  })));
  for (const l of o.lines) await feedIndex(tx, l.indexKey, l.unitHalalas);
  return ord;
}

const orderEvent = (tx: Tx, o: { id: string; buyerCompanyId: string; supplierCompanyId: string }, actor: Actor, en: string, ar: string) =>
  logEvent(tx, { refType: 'order', refId: o.id, buyer: o.buyerCompanyId, supplier: o.supplierCompanyId, actor, en, ar });

// ---------------------------------------------------------------- requests
export async function createRequest(me: Me, d: { title: string; description: string; project?: string; costCenter?: string; city: string; needBy?: string; lines: DraftLine[]; by: string }) {
  need(me, 'request.create');
  if (me.company.type !== 'buyer') throw deny();
  if (!d.lines.length) throw new OpsError('Add at least one line item.', 'أضف بنداً واحداً على الأقل.');
  const out = new Outbox();
  const id = await withTenant(me.company.id, async (tx) => {
    const number = await nextNo(tx, 'request_seq', 'REQ', 5);
    const est = d.lines.reduce((s, l) => s + lineTotal(l.qty, l.estUnitHalalas), 0);
    const [r] = await tx.insert(schema.requests).values({
      buyerCompanyId: me.company.id, number, title: d.title, description: d.description, project: d.project || null, costCenter: d.costCenter || null,
      deliveryCity: d.city, needBy: d.needBy || null, status: 'submitted', structuredBy: d.by, estimatedHalalas: est, createdBy: me.id, createdByName: me.name
    }).returning();
    await tx.insert(schema.requestLines).values(d.lines.map((l, i) => ({
      requestId: r.id, buyerCompanyId: me.company.id, lineNo: i + 1, item: l.item, spec: l.spec, qty: l.qty, unit: l.unit, category: l.category, indexKey: l.indexKey, estUnitHalalas: l.estUnitHalalas
    })));
    await logEvent(tx, { refType: 'request', refId: r.id, buyer: me.company.id, actor: actorOf(me), en: `Request ${number} submitted with ${d.lines.length} line items`, ar: `أُرسل الطلب ${number} بعدد ${d.lines.length} بنود` });
    out.notify(me.company.id, rolesFor('buyer', 'request.triage'), `New request ${number}: ${d.title}`, `طلب جديد ${number}: ${d.title}`, `/app/requests/${r.id}`);
    return r.id;
  });
  await out.flush();
  return id;
}

export async function cancelRequest(me: Me, requestId: string) {
  need(me, 'request.triage');
  await withTenant(me.company.id, async (tx) => {
    const [r] = await tx.select().from(schema.requests).where(eq(schema.requests.id, requestId)).for('update');
    if (!r || r.status !== 'submitted') throw stale();
    await tx.update(schema.requests).set({ status: 'cancelled' }).where(eq(schema.requests.id, r.id));
    await logEvent(tx, { refType: 'request', refId: r.id, buyer: me.company.id, actor: actorOf(me), en: 'Request cancelled', ar: 'أُلغي الطلب' });
  });
}

async function refreshRequestStatus(tx: Tx, requestId: string) {
  const lines = await tx.select().from(schema.requestLines).where(eq(schema.requestLines.requestId, requestId));
  const allOrdered = lines.every((l) => l.orderId);
  const anyRouted = lines.some((l) => l.route);
  await tx.update(schema.requests).set({ status: allOrdered ? 'done' : anyRouted ? 'sourcing' : 'submitted' }).where(eq(schema.requests.id, requestId));
}

/** Triage: buy chosen lines from live offers now (one market order per supplier). */
export async function buyLinesFromMarket(me: Me, requestId: string, picks: { lineId: string; offerId: string; term: Term }[]) {
  need(me, 'request.triage');
  if (!picks.length) return [];
  const out = new Outbox();
  const ids = await withSystem(async (tx) => {
    const [req] = await tx.select().from(schema.requests).where(and(eq(schema.requests.id, requestId), eq(schema.requests.buyerCompanyId, me.company.id))).for('update');
    if (!req || req.status === 'cancelled' || req.status === 'done') throw stale();
    const lines = await tx.select().from(schema.requestLines).where(and(eq(schema.requestLines.requestId, requestId), inArray(schema.requestLines.id, picks.map((p) => p.lineId))));
    const offers = await tx.select().from(schema.offers).where(inArray(schema.offers.id, picks.map((p) => p.offerId))).for('update');
    const bySupplier = new Map<string, { offer: typeof offers[number]; line: typeof lines[number]; term: Term }[]>();
    let total = 0;
    for (const p of picks) {
      const line = lines.find((l) => l.id === p.lineId); const offer = offers.find((o) => o.id === p.offerId);
      if (!line || line.route || !offer) throw stale();
      if (offer.status !== 'active' || offer.validUntil < new Date() || offer.qtyAvailable < line.qty) throw new OpsError(`Offer ${offer.number} no longer has enough stock.`, `العرض ${offer.number} لم يعد لديه كمية كافية.`);
      const price = p.term === 'adv' ? offer.priceAdvHalalas : p.term === 'nd' ? offer.priceNdHalalas : offer.price30Halalas;
      total += lineTotal(line.qty, price);
      const k = `${offer.supplierCompanyId}|${p.term}`;
      bySupplier.set(k, [...(bySupplier.get(k) ?? []), { offer, line, term: p.term }]);
    }
    await checkLimit(tx, me.company.id, total + vatOf(total));
    const created: string[] = [];
    for (const group of bySupplier.values()) {
      const { offer, term } = group[0];
      const ord = await createOrderTx(tx, {
        kind: 'market', buyerId: me.company.id, buyerName: me.company.name, supplierId: offer.supplierCompanyId, supplierName: offer.supplierName, term,
        deliveryCity: req.deliveryCity, originCity: offer.city, leadDays: Math.max(...group.map((g) => g.offer.leadDays)), status: 'accepted', createdBy: me.id, requestId, offerId: offer.id,
        lines: group.map((g) => ({ item: g.line.item, spec: g.line.spec || g.offer.spec, unit: g.line.unit, indexKey: g.line.indexKey ?? g.offer.indexKey, qty: g.line.qty, unitHalalas: term === 'adv' ? g.offer.priceAdvHalalas : term === 'nd' ? g.offer.priceNdHalalas : g.offer.price30Halalas }))
      });
      for (const g of group) {
        const left = g.offer.qtyAvailable - g.line.qty;
        await tx.update(schema.offers).set({ qtyAvailable: left, status: left < g.offer.minQty ? 'sold_out' : g.offer.status }).where(eq(schema.offers.id, g.offer.id));
        g.offer.qtyAvailable = left;
        await tx.update(schema.requestLines).set({ route: 'market', orderId: ord.id }).where(eq(schema.requestLines.id, g.line.id));
      }
      await orderEvent(tx, ord, actorOf(me), `Market order ${ord.number} placed from live offers (binding contract)`, `صدر طلب سوق ${ord.number} من العروض المباشرة (عقد ملزم)`);
      await logEvent(tx, { refType: 'request', refId: requestId, buyer: me.company.id, actor: actorOf(me), en: `${group.length} line(s) bought from ${offer.supplierName} as ${ord.number}`, ar: `اشتُري ${group.length} بند من ${offer.supplierName} بالطلب ${ord.number}` });
      out.notify(offer.supplierCompanyId, rolesFor('supplier', 'order.fulfil'), `New market order ${ord.number} from ${me.company.name}`, `طلب سوق جديد ${ord.number} من ${me.company.name}`, `/app/orders/${ord.id}`);
      created.push(ord.id);
    }
    await refreshRequestStatus(tx, requestId);
    return created;
  });
  await out.flush();
  return ids;
}

// ---------------------------------------------------------------- RFQs
export async function supplierDirectory(tx: Tx): Promise<Profile[]> {
  const rows = await tx.select().from(schema.companyProfiles).where(and(eq(schema.companyProfiles.type, 'supplier'), eq(schema.companyProfiles.active, true)));
  return rows.map((r) => ({ companyId: r.companyId, name: r.name, city: r.city, categories: r.categories, citiesServed: r.citiesServed, rating: r.rating, ratingCount: r.ratingCount, localContent: r.localContent, verified: r.verified }));
}

export async function createRfq(me: Me, d: { requestId: string; lineIds: string[]; supplierIds: string[]; deadlineHours: number; terms: string }) {
  need(me, 'rfq.manage');
  if (!d.lineIds.length) throw new OpsError('Select at least one line.', 'اختر بنداً واحداً على الأقل.');
  if (!d.supplierIds.length) throw new OpsError('Invite at least one supplier.', 'ادعُ مورداً واحداً على الأقل.');
  const out = new Outbox();
  const id = await withTenant(me.company.id, async (tx) => {
    const [req] = await tx.select().from(schema.requests).where(eq(schema.requests.id, d.requestId)).for('update');
    if (!req || req.status === 'cancelled' || req.status === 'done') throw stale();
    const lines = await tx.select().from(schema.requestLines).where(and(eq(schema.requestLines.requestId, req.id), inArray(schema.requestLines.id, d.lineIds)));
    if (lines.length !== d.lineIds.length || lines.some((l) => l.route)) throw stale();
    const dir = await supplierDirectory(tx);
    const matches = matchSuppliers(lines.map((l) => l.category), req.deliveryCity, dir);
    const chosen = d.supplierIds.map((sid) => matches.find((m) => m.profile.companyId === sid) ?? (() => {
      const p = dir.find((x) => x.companyId === sid); if (!p) throw stale();
      return { profile: p, score: 0, coverage: 0, reasonEn: 'Added manually', reasonAr: 'أُضيف يدوياً' };
    })());
    const number = await nextNo(tx, 'rfq_seq', 'RFQ', 5);
    const [rfq] = await tx.insert(schema.rfqs).values({
      buyerCompanyId: me.company.id, buyerName: me.company.name, requestId: req.id, number, title: req.title, deliveryCity: req.deliveryCity, needBy: req.needBy,
      deadline: new Date(Date.now() + d.deadlineHours * 3600_000), terms: d.terms, status: 'open', createdBy: me.id
    }).returning();
    await tx.insert(schema.rfqLines).values(lines.sort((a, b) => a.lineNo - b.lineNo).map((l, i) => ({
      rfqId: rfq.id, buyerCompanyId: me.company.id, lineNo: i + 1, item: l.item, spec: l.spec, qty: l.qty, unit: l.unit, category: l.category, indexKey: l.indexKey, estUnitHalalas: l.estUnitHalalas
    })));
    await tx.insert(schema.rfqInvites).values(chosen.map((m) => ({
      rfqId: rfq.id, buyerCompanyId: me.company.id, supplierCompanyId: m.profile.companyId, supplierName: m.profile.name, matchScore: m.score, matchReason: `${m.reasonEn}\n${m.reasonAr}`
    })));
    await tx.update(schema.requestLines).set({ route: 'rfq', rfqId: rfq.id }).where(inArray(schema.requestLines.id, d.lineIds));
    await refreshRequestStatus(tx, req.id);
    await logEvent(tx, { refType: 'rfq', refId: rfq.id, buyer: me.company.id, actor: actorOf(me), en: `${number} published to ${chosen.length} matched suppliers`, ar: `نُشر ${number} إلى ${chosen.length} موردين مطابقين` });
    await logEvent(tx, { refType: 'request', refId: req.id, buyer: me.company.id, actor: actorOf(me), en: `${lines.length} line(s) sent to ${number}`, ar: `أُرسل ${lines.length} بند إلى ${number}` });
    for (const m of chosen) out.notify(m.profile.companyId, rolesFor('supplier', 'quote.submit'), `New RFQ ${number} from ${me.company.name} (match ${m.score}%)`, `طلب عروض جديد ${number} من ${me.company.name} (مطابقة ${m.score}%)`, `/app/opportunities/${rfq.id}`);
    return rfq.id;
  });
  await out.flush();
  return id;
}

/** Bidding closes automatically once the deadline passes (checked whenever the RFQ is opened). */
export async function autoCloseRfq(rfqId: string, buyerId: string) {
  await withSystem(async (tx) => {
    const [r] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, rfqId));
    if (r && r.buyerCompanyId === buyerId && r.status === 'open' && r.deadline < new Date()) {
      await tx.update(schema.rfqs).set({ status: 'evaluation' }).where(and(eq(schema.rfqs.id, rfqId), eq(schema.rfqs.status, 'open')));
      await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: buyerId, actor: { name: 'Tawreed', role: 'system' }, en: 'Bidding deadline reached; quotes opened for evaluation', ar: 'انتهت مهلة العروض وفُتحت العروض للتقييم' });
    }
  });
}

export async function closeBidding(me: Me, rfqId: string) {
  need(me, 'rfq.manage');
  await withTenant(me.company.id, async (tx) => {
    const r = await tx.update(schema.rfqs).set({ status: 'evaluation' }).where(and(eq(schema.rfqs.id, rfqId), eq(schema.rfqs.status, 'open'))).returning();
    if (!r.length) throw stale();
    const [{ n }] = await tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.quotes).where(eq(schema.quotes.rfqId, rfqId));
    if (n === 0) {
      await tx.update(schema.rfqs).set({ status: 'open' }).where(eq(schema.rfqs.id, rfqId));
      throw new OpsError('No quotes received yet. Wait for at least one quote before closing.', 'لم تصل عروض بعد. انتظر عرضاً واحداً على الأقل قبل الإغلاق.');
    }
    await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: me.company.id, actor: actorOf(me), en: `Bidding closed early; ${n} sealed quote(s) opened`, ar: `أُغلقت العروض مبكراً وفُتح ${n} عرض مختوم` });
  });
}

export async function askQuestion(me: Me, rfqId: string, question: string) {
  need(me, 'quote.submit');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [inv] = await tx.select().from(schema.rfqInvites).where(and(eq(schema.rfqInvites.rfqId, rfqId), eq(schema.rfqInvites.supplierCompanyId, me.company.id)));
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, rfqId));
    if (!inv || !rfq || rfq.status !== 'open') throw stale();
    await tx.insert(schema.rfqQuestions).values({ rfqId, buyerCompanyId: inv.buyerCompanyId, supplierCompanyId: me.company.id, supplierName: me.company.name, question });
    await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: inv.buyerCompanyId, supplier: me.company.id, actor: actorOf(me), en: `Question from ${me.company.name}`, ar: `سؤال من ${me.company.name}` });
    out.notify(inv.buyerCompanyId, rolesFor('buyer', 'rfq.manage'), `${rfq.number}: question from ${me.company.name}`, `${rfq.number}: سؤال من ${me.company.name}`, `/app/rfqs/${rfqId}`);
  });
  await out.flush();
}

export async function answerQuestion(me: Me, questionId: string, answer: string) {
  need(me, 'rfq.manage');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [q] = await tx.select().from(schema.rfqQuestions).where(eq(schema.rfqQuestions.id, questionId)).for('update');
    if (!q || q.answer) throw stale();
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, q.rfqId));
    await tx.update(schema.rfqQuestions).set({ answer, answeredAt: new Date() }).where(eq(schema.rfqQuestions.id, q.id));
    // the clarification is shared with every invited supplier (fair bidding)
    const invites = await tx.select().from(schema.rfqInvites).where(eq(schema.rfqInvites.rfqId, q.rfqId));
    for (const i of invites) {
      if (i.supplierCompanyId !== q.supplierCompanyId) {
        await tx.insert(schema.rfqQuestions).values({ rfqId: q.rfqId, buyerCompanyId: me.company.id, supplierCompanyId: i.supplierCompanyId, supplierName: 'Shared clarification', question: q.question, answer, answeredAt: new Date() });
      }
      out.notify(i.supplierCompanyId, rolesFor('supplier', 'quote.submit'), `${rfq.number}: clarification published`, `${rfq.number}: نُشر توضيح`, `/app/opportunities/${q.rfqId}`);
    }
    await logEvent(tx, { refType: 'rfq', refId: q.rfqId, buyer: me.company.id, actor: actorOf(me), en: 'Clarification sent to all bidders', ar: 'أُرسل توضيح لجميع المتقدمين' });
  });
  await out.flush();
}

export async function submitQuote(me: Me, rfqId: string, d: { leadDays: number; validDays: number; notes: string; prices: Record<string, number> }) {
  need(me, 'quote.submit');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, rfqId));
    const [inv] = await tx.select().from(schema.rfqInvites).where(and(eq(schema.rfqInvites.rfqId, rfqId), eq(schema.rfqInvites.supplierCompanyId, me.company.id)));
    if (!rfq || !inv) throw deny();
    if (rfq.status !== 'open' || rfq.deadline < new Date()) throw new OpsError('Bidding has closed for this RFQ.', 'أُغلقت فترة العروض لهذا الطلب.');
    const lines = await tx.select().from(schema.rfqLines).where(eq(schema.rfqLines.rfqId, rfqId));
    if (lines.some((l) => !(d.prices[l.id] > 0))) throw new OpsError('Enter a unit price for every line.', 'أدخل سعر الوحدة لكل بند.');
    if (!(d.leadDays >= 1 && d.leadDays <= 365)) throw new OpsError('Lead time must be between 1 and 365 days.', 'مدة التوريد يجب أن تكون بين 1 و365 يوماً.');
    const subtotal = lines.reduce((s, l) => s + lineTotal(l.qty, d.prices[l.id]), 0);
    const [existing] = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.rfqId, rfqId), eq(schema.quotes.supplierCompanyId, me.company.id)));
    let quoteId: string;
    if (existing) {
      await tx.update(schema.quotes).set({ leadDays: d.leadDays, validDays: d.validDays, notes: d.notes, subtotalHalalas: subtotal, submittedAt: new Date(), submittedBy: me.id }).where(eq(schema.quotes.id, existing.id));
      await tx.delete(schema.quoteLines).where(eq(schema.quoteLines.quoteId, existing.id));
      quoteId = existing.id;
    } else {
      const [q] = await tx.insert(schema.quotes).values({ rfqId, buyerCompanyId: rfq.buyerCompanyId, supplierCompanyId: me.company.id, supplierName: me.company.name, leadDays: d.leadDays, validDays: d.validDays, notes: d.notes, subtotalHalalas: subtotal, submittedBy: me.id }).returning();
      quoteId = q.id;
    }
    await tx.insert(schema.quoteLines).values(lines.map((l) => ({ quoteId, rfqLineId: l.id, buyerCompanyId: rfq.buyerCompanyId, supplierCompanyId: me.company.id, unitHalalas: d.prices[l.id] })));
    await tx.update(schema.rfqInvites).set({ status: 'quoted' }).where(eq(schema.rfqInvites.id, inv.id));
    await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: rfq.buyerCompanyId, supplier: me.company.id, actor: actorOf(me), en: `Sealed quote ${existing ? 'updated' : 'received'} from ${me.company.name}`, ar: `${existing ? 'حُدّث' : 'وصل'} عرض مختوم من ${me.company.name}` });
    if (!existing) out.notify(rfq.buyerCompanyId, rolesFor('buyer', 'rfq.manage'), `${rfq.number}: sealed quote received from ${me.company.name}`, `${rfq.number}: وصل عرض مختوم من ${me.company.name}`, `/app/rfqs/${rfqId}`);
  });
  await out.flush();
}

export async function declineInvite(me: Me, rfqId: string) {
  need(me, 'quote.submit');
  await withTenant(me.company.id, async (tx) => {
    const r = await tx.update(schema.rfqInvites).set({ status: 'declined' }).where(and(eq(schema.rfqInvites.rfqId, rfqId), eq(schema.rfqInvites.supplierCompanyId, me.company.id), inArray(schema.rfqInvites.status, ['invited', 'viewed']))).returning();
    if (!r.length) throw stale();
    await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: r[0].buyerCompanyId, supplier: me.company.id, actor: actorOf(me), en: `${me.company.name} declined to quote`, ar: `اعتذر ${me.company.name} عن التقديم` });
  });
}

export async function requestDiscount(me: Me, quoteId: string, pct: number) {
  need(me, 'rfq.manage');
  if (!(pct > 0 && pct <= 20)) throw new OpsError('Target discount must be between 0.5% and 20%.', 'الخصم المستهدف بين 0.5% و20%.');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).for('update');
    const [rfq] = q ? await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, q.rfqId)) : [];
    if (!q || !rfq || rfq.status !== 'evaluation' || q.negotiation?.status === 'pending') throw stale();
    await tx.update(schema.quotes).set({ negotiation: { targetPct: pct, status: 'pending', at: new Date().toISOString() } }).where(eq(schema.quotes.id, q.id));
    await logEvent(tx, { refType: 'rfq', refId: rfq.id, buyer: me.company.id, supplier: q.supplierCompanyId, actor: actorOf(me), en: `Counter-offer sent to ${q.supplierName}: ${pct}% off`, ar: `أُرسل عرض مقابل إلى ${q.supplierName}: خصم ${pct}%` });
    out.notify(q.supplierCompanyId, rolesFor('supplier', 'quote.submit'), `${rfq.number}: buyer asks for ${pct}% off your quote`, `${rfq.number}: المشتري يطلب خصم ${pct}% على عرضك`, `/app/opportunities/${rfq.id}`);
  });
  await out.flush();
}

export async function respondDiscount(me: Me, quoteId: string, accept: boolean) {
  need(me, 'quote.submit');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [q] = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.supplierCompanyId, me.company.id))).for('update');
    if (!q || q.negotiation?.status !== 'pending') throw stale();
    const neg = { ...q.negotiation, status: accept ? 'accepted' as const : 'declined' as const };
    await tx.update(schema.quotes).set({ negotiation: neg, discountPct: accept ? q.negotiation.targetPct : q.discountPct }).where(eq(schema.quotes.id, q.id));
    await logEvent(tx, { refType: 'rfq', refId: q.rfqId, buyer: q.buyerCompanyId, supplier: me.company.id, actor: actorOf(me), en: `${me.company.name} ${accept ? `accepted ${q.negotiation.targetPct}% discount` : 'declined the counter-offer'}`, ar: `${me.company.name} ${accept ? `وافق على خصم ${q.negotiation.targetPct}%` : 'رفض العرض المقابل'}` });
    out.notify(q.buyerCompanyId, rolesFor('buyer', 'rfq.manage'), `${me.company.name} ${accept ? 'accepted' : 'declined'} your counter-offer`, `${me.company.name} ${accept ? 'وافق على' : 'رفض'} عرضك المقابل`, `/app/rfqs/${q.rfqId}`);
  });
  await out.flush();
}

export const quoteNet = (q: { subtotalHalalas: number; discountPct: number }) => Math.round(q.subtotalHalalas * (1 - q.discountPct / 100));

export async function awardQuote(me: Me, rfqId: string, quoteId: string, justification: string) {
  need(me, 'rfq.manage');
  const out = new Outbox();
  const result = await withTenant(me.company.id, async (tx) => {
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, rfqId)).for('update');
    const [q] = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.rfqId, rfqId)));
    if (!rfq || !q || rfq.status !== 'evaluation') throw stale();
    const net = quoteNet(q);
    const s = await getSettings(tx, me.company.id);
    if (net > s.approvalThresholdHalalas) {
      await tx.insert(schema.approvals).values({ buyerCompanyId: me.company.id, rfqId, quoteId, supplierName: q.supplierName, amountHalalas: net + vatOf(net), requestedBy: me.id, justification });
      await tx.update(schema.rfqs).set({ status: 'pending_approval', awardedQuoteId: q.id, awardNote: justification || null }).where(eq(schema.rfqs.id, rfqId));
      await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: me.company.id, actor: actorOf(me), en: `Award to ${q.supplierName} sent to Finance (above the approval threshold)`, ar: `أُرسلت الترسية على ${q.supplierName} للمالية (أعلى من حد الاعتماد)` });
      out.notify(me.company.id, rolesFor('buyer', 'approval.decide'), `Approval needed: ${rfq.number} award to ${q.supplierName}`, `مطلوب اعتماد: ترسية ${rfq.number} على ${q.supplierName}`, '/app/approvals');
      return 'approval';
    }
    await tx.update(schema.rfqs).set({ status: 'approved', awardedQuoteId: q.id, awardNote: justification || null }).where(eq(schema.rfqs.id, rfqId));
    await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: me.company.id, actor: actorOf(me), en: `Awarded to ${q.supplierName}; approved automatically (below threshold)`, ar: `تمت الترسية على ${q.supplierName} واعتُمدت تلقائياً (أقل من الحد)` });
    return 'approved';
  });
  await out.flush();
  return result;
}

export async function decideApproval(me: Me, approvalId: string, approve: boolean, comment: string) {
  need(me, 'approval.decide');
  if (!approve && comment.trim().length < 3) throw new OpsError('Add a comment explaining why the award is returned.', 'أضف ملاحظة توضح سبب إعادة الترسية.');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [a] = await tx.select().from(schema.approvals).where(eq(schema.approvals.id, approvalId)).for('update');
    if (!a || a.status !== 'pending') throw stale();
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, a.rfqId));
    await tx.update(schema.approvals).set({ status: approve ? 'approved' : 'returned', comment: comment || null, decidedBy: me.id, decidedAt: new Date() }).where(eq(schema.approvals.id, a.id));
    if (approve) {
      await tx.update(schema.rfqs).set({ status: 'approved' }).where(eq(schema.rfqs.id, a.rfqId));
    } else {
      await tx.update(schema.rfqs).set({ status: 'evaluation', awardedQuoteId: null, awardNote: `Returned by Finance: ${comment}` }).where(eq(schema.rfqs.id, a.rfqId));
    }
    await logEvent(tx, { refType: 'rfq', refId: a.rfqId, buyer: me.company.id, actor: actorOf(me), en: approve ? 'Award approved by Finance' : `Award returned by Finance: ${comment}`, ar: approve ? 'اعتمدت المالية الترسية' : `أعادت المالية الترسية: ${comment}` });
    out.notify(me.company.id, rolesFor('buyer', 'rfq.manage'), approve ? `${rfq.number} approved. Issue the PO.` : `${rfq.number} returned by Finance`, approve ? `اعتُمد ${rfq.number}. أصدر أمر الشراء.` : `أعادت المالية ${rfq.number}`, `/app/rfqs/${a.rfqId}`);
  });
  await out.flush();
}

export async function issuePo(me: Me, rfqId: string) {
  need(me, 'rfq.manage');
  const out = new Outbox();
  const id = await withTenant(me.company.id, async (tx) => {
    const [rfq] = await tx.select().from(schema.rfqs).where(eq(schema.rfqs.id, rfqId)).for('update');
    if (!rfq || rfq.status !== 'approved' || !rfq.awardedQuoteId) throw stale();
    const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, rfq.awardedQuoteId));
    const lines = await tx.select().from(schema.rfqLines).where(eq(schema.rfqLines.rfqId, rfqId));
    const qls = await tx.select().from(schema.quoteLines).where(eq(schema.quoteLines.quoteId, q.id));
    const net = quoteNet(q);
    await checkLimit(tx, me.company.id, net + vatOf(net));
    const supplierProfile = await profile(tx, q.supplierCompanyId);
    const ord = await createOrderTx(tx, {
      kind: 'po', buyerId: me.company.id, buyerName: me.company.name, supplierId: q.supplierCompanyId, supplierName: q.supplierName, term: 'r30',
      deliveryCity: rfq.deliveryCity, originCity: supplierProfile?.city ?? rfq.deliveryCity, leadDays: q.leadDays, status: 'issued', createdBy: me.id,
      requestId: rfq.requestId, rfqId, quoteId: q.id,
      lines: lines.sort((a, b) => a.lineNo - b.lineNo).map((l) => ({ item: l.item, spec: l.spec, unit: l.unit, indexKey: l.indexKey, qty: l.qty, unitHalalas: Math.round((qls.find((x) => x.rfqLineId === l.id)?.unitHalalas ?? 0) * (1 - q.discountPct / 100)) }))
    });
    await tx.update(schema.rfqs).set({ status: 'ordered' }).where(eq(schema.rfqs.id, rfqId));
    await tx.update(schema.quotes).set({ status: 'lost' }).where(and(eq(schema.quotes.rfqId, rfqId), ne(schema.quotes.id, q.id)));
    await tx.update(schema.quotes).set({ status: 'awarded' }).where(eq(schema.quotes.id, q.id));
    if (rfq.requestId) {
      await tx.update(schema.requestLines).set({ orderId: ord.id }).where(eq(schema.requestLines.rfqId, rfqId));
      await refreshRequestStatus(tx, rfq.requestId);
    }
    await logEvent(tx, { refType: 'rfq', refId: rfqId, buyer: me.company.id, actor: actorOf(me), en: `Purchase order ${ord.number} issued to ${q.supplierName}`, ar: `صدر أمر الشراء ${ord.number} إلى ${q.supplierName}` });
    await orderEvent(tx, ord, actorOf(me), `Purchase order ${ord.number} issued (${rfq.number})`, `صدر أمر الشراء ${ord.number} (${rfq.number})`);
    out.notify(q.supplierCompanyId, rolesFor('supplier', 'order.fulfil'), `You won ${rfq.number}: purchase order ${ord.number}`, `فزت بـ${rfq.number}: أمر الشراء ${ord.number}`, `/app/orders/${ord.id}`);
    const losers = await tx.select().from(schema.quotes).where(and(eq(schema.quotes.rfqId, rfqId), ne(schema.quotes.id, q.id)));
    for (const l of losers) out.notify(l.supplierCompanyId, rolesFor('supplier', 'quote.submit'), `${rfq.number} was awarded to another supplier`, `تمت ترسية ${rfq.number} على مورد آخر`, `/app/opportunities/${rfqId}`);
    return ord.id;
  });
  await out.flush();
  return id;
}

// ---------------------------------------------------------------- market
export async function postOffer(me: Me, d: { item: string; spec: string; category: string; indexKey: string | null; unit: string; city: string; qty: number; minQty: number; adv: number; nd: number; r30: number; leadDays: number; validDays: number }) {
  need(me, 'offer.manage');
  if (me.company.type !== 'supplier') throw deny();
  if (!(d.qty > 0 && d.minQty > 0 && d.minQty <= d.qty)) throw new OpsError('Quantity and minimum order must be positive, and minimum ≤ quantity.', 'الكمية والحد الأدنى يجب أن تكون موجبة والحد الأدنى ≤ الكمية.');
  if (!(d.adv > 0 && d.nd > 0 && d.r30 > 0)) throw new OpsError('Enter all three prices.', 'أدخل الأسعار الثلاثة.');
  return withTenant(me.company.id, async (tx) => {
    const number = await nextNo(tx, 'offer_seq', 'OF', 5);
    const [o] = await tx.insert(schema.offers).values({
      number, supplierCompanyId: me.company.id, supplierName: me.company.name, item: d.item, spec: d.spec, category: d.category, indexKey: d.indexKey, unit: d.unit, city: d.city,
      qtyAvailable: d.qty, minQty: d.minQty, priceAdvHalalas: d.adv, priceNdHalalas: d.nd, price30Halalas: d.r30, leadDays: d.leadDays, validUntil: new Date(Date.now() + d.validDays * 86400_000)
    }).returning();
    return o.id;
  });
}

export async function setOfferStatus(me: Me, offerId: string, status: 'active' | 'paused') {
  need(me, 'offer.manage');
  await withTenant(me.company.id, async (tx) => {
    const r = await tx.update(schema.offers).set({ status }).where(and(eq(schema.offers.id, offerId), eq(schema.offers.supplierCompanyId, me.company.id), ne(schema.offers.status, 'sold_out'))).returning();
    if (!r.length) throw stale();
  });
}

const termPrice = (o: typeof schema.offers.$inferSelect, t: Term) => (t === 'adv' ? o.priceAdvHalalas : t === 'nd' ? o.priceNdHalalas : o.price30Halalas);

export async function buyOffer(me: Me, offerId: string, qty: number, term: Term) {
  need(me, 'market.buy');
  if (me.company.type !== 'buyer') throw deny();
  const out = new Outbox();
  const id = await withSystem(async (tx) => {
    const [o] = await tx.select().from(schema.offers).where(eq(schema.offers.id, offerId)).for('update');
    if (!o || o.status !== 'active' || o.validUntil < new Date()) throw new OpsError('This offer is no longer available.', 'هذا العرض لم يعد متاحاً.');
    if (!(qty >= o.minQty)) throw new OpsError(`Minimum order is ${o.minQty} ${o.unit}.`, `الحد الأدنى للطلب ${o.minQty} ${o.unit}.`);
    if (qty > o.qtyAvailable) throw new OpsError(`Only ${o.qtyAvailable} ${o.unit} available.`, `المتوفر ${o.qtyAvailable} ${o.unit} فقط.`);
    const unit = termPrice(o, term);
    const sub = lineTotal(qty, unit);
    await checkLimit(tx, me.company.id, sub + vatOf(sub));
    const ord = await createOrderTx(tx, {
      kind: 'market', buyerId: me.company.id, buyerName: me.company.name, supplierId: o.supplierCompanyId, supplierName: o.supplierName, term,
      deliveryCity: me.company.city, originCity: o.city, leadDays: o.leadDays, status: 'accepted', createdBy: me.id, offerId: o.id,
      lines: [{ item: o.item, spec: o.spec, unit: o.unit, indexKey: o.indexKey, qty, unitHalalas: unit }]
    });
    const left = o.qtyAvailable - qty;
    await tx.update(schema.offers).set({ qtyAvailable: left, status: left < o.minQty ? 'sold_out' : 'active' }).where(eq(schema.offers.id, o.id));
    await orderEvent(tx, ord, actorOf(me), `Bought ${qty} ${o.unit} from offer ${o.number} (binding contract for both sides)`, `اشتُري ${qty} ${o.unit} من العرض ${o.number} (عقد ملزم للطرفين)`);
    out.notify(o.supplierCompanyId, rolesFor('supplier', 'order.fulfil'), `New market order ${ord.number} from ${me.company.name}`, `طلب سوق جديد ${ord.number} من ${me.company.name}`, `/app/orders/${ord.id}`);
    return ord.id;
  });
  await out.flush();
  return id;
}

export async function counterOffer(me: Me, offerId: string, qty: number, term: Term, unitHalalas: number) {
  need(me, 'market.buy');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const [o] = await tx.select().from(schema.offers).where(eq(schema.offers.id, offerId));
    if (!o || o.status !== 'active') throw new OpsError('This offer is no longer available.', 'هذا العرض لم يعد متاحاً.');
    if (!(qty >= o.minQty && qty <= o.qtyAvailable)) throw new OpsError(`Quantity must be between ${o.minQty} and ${o.qtyAvailable}.`, `الكمية يجب أن تكون بين ${o.minQty} و${o.qtyAvailable}.`);
    if (!(unitHalalas > 0)) throw new OpsError('Enter your price.', 'أدخل سعرك.');
    await tx.insert(schema.counterOffers).values({ offerId, buyerCompanyId: me.company.id, buyerName: me.company.name, supplierCompanyId: o.supplierCompanyId, qty, term, unitHalalas, createdBy: me.id });
    out.notify(o.supplierCompanyId, rolesFor('supplier', 'offer.manage'), `Counter-offer on ${o.number} from ${me.company.name}`, `سعر مقابل على ${o.number} من ${me.company.name}`, '/app/offers');
  });
  await out.flush();
}

export async function decideCounter(me: Me, counterId: string, accept: boolean) {
  need(me, 'offer.manage');
  const out = new Outbox();
  const orderId = await withSystem(async (tx) => {
    const [c] = await tx.select().from(schema.counterOffers).where(eq(schema.counterOffers.id, counterId)).for('update');
    if (!c || c.supplierCompanyId !== me.company.id) throw deny();
    if (c.status !== 'pending') throw stale();
    const [o] = await tx.select().from(schema.offers).where(eq(schema.offers.id, c.offerId)).for('update');
    if (!accept) {
      await tx.update(schema.counterOffers).set({ status: 'declined', decidedAt: new Date() }).where(eq(schema.counterOffers.id, c.id));
      out.notify(c.buyerCompanyId, rolesFor('buyer', 'market.buy'), `${me.company.name} declined your counter-offer on ${o.number}`, `رفض ${me.company.name} سعرك المقابل على ${o.number}`, '/app/market');
      return null;
    }
    if (o.status === 'sold_out' || o.qtyAvailable < c.qty) throw new OpsError('Not enough stock left on this offer.', 'لا توجد كمية كافية في هذا العرض.');
    const [buyer] = await tx.select().from(schema.companies).where(eq(schema.companies.id, c.buyerCompanyId));
    const sub = lineTotal(c.qty, c.unitHalalas);
    await checkLimit(tx, c.buyerCompanyId, sub + vatOf(sub));
    const ord = await createOrderTx(tx, {
      kind: 'market', buyerId: c.buyerCompanyId, buyerName: c.buyerName, supplierId: me.company.id, supplierName: me.company.name, term: c.term as Term,
      deliveryCity: buyer.city, originCity: o.city, leadDays: o.leadDays, status: 'accepted', createdBy: me.id, offerId: o.id,
      lines: [{ item: o.item, spec: o.spec, unit: o.unit, indexKey: o.indexKey, qty: c.qty, unitHalalas: c.unitHalalas }]
    });
    const left = o.qtyAvailable - c.qty;
    await tx.update(schema.offers).set({ qtyAvailable: left, status: left < o.minQty ? 'sold_out' : o.status }).where(eq(schema.offers.id, o.id));
    await tx.update(schema.counterOffers).set({ status: 'accepted', decidedAt: new Date(), orderId: ord.id }).where(eq(schema.counterOffers.id, c.id));
    await orderEvent(tx, ord, actorOf(me), `Counter-offer accepted; market order ${ord.number} created`, `قُبل السعر المقابل وصدر طلب السوق ${ord.number}`);
    out.notify(c.buyerCompanyId, rolesFor('buyer', 'market.buy'), `${me.company.name} accepted your counter-offer: ${ord.number}`, `وافق ${me.company.name} على سعرك المقابل: ${ord.number}`, `/app/orders/${ord.id}`);
    return ord.id;
  });
  await out.flush();
  return orderId;
}

// ---------------------------------------------------------------- order fulfilment
async function lockOrder(tx: Tx, me: Me, orderId: string, expect: string, side: 'buyer' | 'supplier') {
  const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for('update');
  if (!o) throw deny();
  if ((side === 'buyer' ? o.buyerCompanyId : o.supplierCompanyId) !== me.company.id) throw deny();
  if (o.status !== expect) throw stale();
  return o;
}
const setStatus = (tx: Tx, id: string, status: string, extra: Partial<typeof schema.orders.$inferInsert> = {}) =>
  tx.update(schema.orders).set({ status, updatedAt: new Date(), ...extra }).where(eq(schema.orders.id, id));

export async function acceptOrder(me: Me, orderId: string) {
  need(me, 'order.fulfil');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'issued', 'supplier');
    await setStatus(tx, o.id, 'accepted');
    await orderEvent(tx, o, actorOf(me), `${o.number} accepted by ${me.company.name}`, `قبل ${me.company.name} أمر الشراء ${o.number}`);
    out.notify(o.buyerCompanyId, rolesFor('buyer', 'rfq.manage'), `${me.company.name} accepted ${o.number}`, `قبل ${me.company.name} أمر الشراء ${o.number}`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

export async function markReady(me: Me, orderId: string, docs: { deliveryNote: string; packages: number; certificates: string; notes: string }) {
  need(me, 'order.fulfil');
  if (!docs.deliveryNote.trim()) throw new OpsError('Enter the delivery note number.', 'أدخل رقم مذكرة التسليم.');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'accepted', 'supplier');
    await setStatus(tx, o.id, 'ready', { docs, replacement: false });
    await orderEvent(tx, o, actorOf(me), `Goods ready to ship${o.replacement ? ' (replacement)' : ''}; delivery note ${docs.deliveryNote}, ${docs.packages} packages`, `البضاعة جاهزة للشحن${o.replacement ? ' (بديلة)' : ''}؛ مذكرة التسليم ${docs.deliveryNote}، ${docs.packages} طرود`);
    out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.logistics'), `${o.number} is ready for pickup in ${o.originCity}`, `${o.number} جاهز للاستلام في ${o.originCity}`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

export async function dispatchOrder(me: Me, orderId: string, carrierId: string) {
  need(me, 'order.logistics');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'ready', 'buyer');
    const c = carrierQuotes(o.originCity, o.deliveryCity).find((x) => x.id === carrierId);
    if (!c) throw stale();
    await tx.update(schema.shipments).set({ active: false }).where(eq(schema.shipments.orderId, o.id));
    const now = new Date();
    const waybill = `${c.id.slice(0, 2).toUpperCase()}-${String(Math.floor(100000 + Math.random() * 899999))}`;
    await tx.insert(schema.shipments).values({ orderId: o.id, buyerCompanyId: o.buyerCompanyId, supplierCompanyId: o.supplierCompanyId, carrier: c.name.en, vehicle: c.vehicle.en, waybill, costHalalas: c.costHalalas, dispatchedAt: now, etaAt: new Date(now.getTime() + c.hours * 3600_000) });
    await setStatus(tx, o.id, 'in_transit');
    await orderEvent(tx, o, actorOf(me), `Dispatched with ${c.name.en}, waybill ${waybill}, ETA ${c.hours} h`, `أُرسلت مع ${c.name.ar}، بوليصة ${waybill}، الوصول خلال ${c.hours} ساعة`);
    out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.receive'), `${o.number} is on the way (ETA ${c.hours} h)`, `${o.number} في الطريق (الوصول خلال ${c.hours} ساعة)`, `/app/orders/${o.id}`);
    out.notify(o.supplierCompanyId, rolesFor('supplier', 'order.fulfil'), `${o.number} picked up by ${c.name.en}`, `استلم ${c.name.ar} الشحنة ${o.number}`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

export async function confirmDelivery(me: Me, orderId: string, podName: string, note: string) {
  need(me, 'order.logistics');
  if (podName.trim().length < 2) throw new OpsError('Enter the name of the person who received the goods.', 'أدخل اسم مستلم البضاعة.');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'in_transit', 'buyer');
    await tx.update(schema.shipments).set({ deliveredAt: new Date(), podName, podNote: note || null }).where(and(eq(schema.shipments.orderId, o.id), eq(schema.shipments.active, true)));
    await setStatus(tx, o.id, 'delivered');
    await orderEvent(tx, o, actorOf(me), `Proof of delivery captured (received by ${podName})`, `سُجّل إثبات التسليم (المستلم: ${podName})`);
    out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.receive'), `${o.number} delivered. Confirm the goods received.`, `تم تسليم ${o.number}. أكّد الاستلام.`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

export async function confirmReceipt(me: Me, orderId: string, received: Record<string, number>) {
  need(me, 'order.receive');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'delivered', 'buyer');
    const lines = await tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, o.id));
    for (const l of lines) {
      const q = received[l.id];
      if (!(q >= 0) || q > l.qty) throw new OpsError(`Received quantity for "${l.item}" must be between 0 and ${l.qty}.`, `الكمية المستلمة لـ"${l.item}" يجب أن تكون بين 0 و${l.qty}.`);
      await tx.update(schema.orderLines).set({ receivedQty: q }).where(eq(schema.orderLines.id, l.id));
    }
    const short = lines.filter((l) => received[l.id] < l.qty).length;
    await setStatus(tx, o.id, 'received');
    await orderEvent(tx, o, actorOf(me), `Goods receipt posted${short ? ` (${short} line(s) short)` : ''}`, `سُجّل سند الاستلام${short ? ` (نقص في ${short} بند)` : ''}`);
    out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.qc'), `Inspection task: ${o.number}`, `مهمة فحص: ${o.number}`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

export async function qcDecision(me: Me, orderId: string, d: { decision: 'pass' | 'partial' | 'reject'; checklist: { label: string; ok: boolean }[]; accepted: Record<string, number>; notes: string }) {
  need(me, 'order.qc');
  if (d.decision !== 'pass' && d.notes.trim().length < 3) throw new OpsError('Describe what failed inspection.', 'صف ما لم يجتز الفحص.');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'received', 'buyer');
    const lines = await tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, o.id));
    let ncr: string | null = null;
    if (d.decision === 'reject') {
      ncr = await nextNo(tx, 'ncr_seq', 'NCR', 4);
      for (const l of lines) await tx.update(schema.orderLines).set({ receivedQty: null, acceptedQty: null }).where(eq(schema.orderLines.id, l.id));
      await setStatus(tx, o.id, 'accepted', { replacement: true });
    } else {
      for (const l of lines) {
        const rec = l.receivedQty ?? l.qty;
        const acc = d.decision === 'pass' ? rec : d.accepted[l.id];
        if (!(acc >= 0) || acc > rec) throw new OpsError(`Accepted quantity for "${l.item}" must be between 0 and ${rec}.`, `الكمية المقبولة لـ"${l.item}" يجب أن تكون بين 0 و${rec}.`);
        await tx.update(schema.orderLines).set({ acceptedQty: acc }).where(eq(schema.orderLines.id, l.id));
      }
      if (lines.every((l) => (d.decision === 'pass' ? (l.receivedQty ?? l.qty) : d.accepted[l.id]) === 0)) throw new OpsError('Nothing accepted: use Reject instead.', 'لم يُقبل شيء: استخدم الرفض بدلاً من ذلك.');
      await setStatus(tx, o.id, 'qc_passed');
    }
    await tx.insert(schema.qualityChecks).values({ orderId: o.id, buyerCompanyId: o.buyerCompanyId, supplierCompanyId: o.supplierCompanyId, decision: d.decision, checklist: d.checklist, notes: d.notes, ncrNumber: ncr, inspectorName: me.name });
    const en = d.decision === 'pass' ? 'Quality check passed; all received goods accepted' : d.decision === 'partial' ? `Quality check: partially accepted (${d.notes})` : `Delivery rejected, ${ncr} raised: ${d.notes}`;
    const ar = d.decision === 'pass' ? 'اجتاز فحص الجودة وقُبلت كل البضاعة المستلمة' : d.decision === 'partial' ? `فحص الجودة: قبول جزئي (${d.notes})` : `رُفضت الشحنة وصدر ${ncr}: ${d.notes}`;
    await orderEvent(tx, o, actorOf(me), en, ar);
    if (d.decision === 'reject') out.notify(o.supplierCompanyId, rolesFor('supplier', 'order.fulfil'), `${o.number} rejected (${ncr}). Replace the goods.`, `رُفض ${o.number} (${ncr}). استبدل البضاعة.`, `/app/orders/${o.id}`);
    else out.notify(o.supplierCompanyId, rolesFor('supplier', 'invoice.issue'), `${o.number} passed inspection. You can invoice.`, `اجتاز ${o.number} الفحص. يمكنك إصدار الفاتورة.`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

/** Supplier e-invoice: billed quantities = quality-accepted quantities at PO prices; auto-paid when within the buyer's auto-pay limit. */
export async function issueInvoice(me: Me, orderId: string) {
  need(me, 'invoice.issue');
  const out = new Outbox();
  const res = await withSystem(async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'qc_passed', 'supplier');
    const lines = await tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, o.id));
    const inv = lines.filter((l) => (l.acceptedQty ?? 0) > 0).map((l) => ({ item: l.item, unit: l.unit, qty: l.acceptedQty ?? 0, unitHalalas: l.unitHalalas }));
    const sub = inv.reduce((s, l) => s + lineTotal(l.qty, l.unitHalalas), 0);
    const vat = vatOf(sub);
    const number = await nextNo(tx, 'tinv_seq', 'INV-T');
    const issuedAt = new Date();
    const id = invoiceIdentity({ number, order: o.number, inv, sub, vat, issuedAt });
    const qr = zatcaQr(me.company.name, me.company.vatNumber, issuedAt, sub + vat, vat);
    // 3-way match: PO price, quality-accepted quantity (≤ received ≤ ordered) and invoice must agree
    const issues: string[] = [];
    for (const l of lines) {
      const il = inv.find((x) => x.item === l.item && x.unitHalalas === l.unitHalalas);
      const acc = l.acceptedQty ?? 0;
      if (acc > (l.receivedQty ?? l.qty)) issues.push(`${l.item}: accepted > received`);
      if (acc > 0 && (!il || il.qty !== acc)) issues.push(`${l.item}: invoiced qty ≠ accepted`);
    }
    const settings = await getSettings(tx, o.buyerCompanyId);
    const autoPay = issues.length === 0 && sub + vat <= settings.autoPayLimitHalalas;
    const [ti] = await tx.insert(schema.tradeInvoices).values({
      orderId: o.id, buyerCompanyId: o.buyerCompanyId, supplierCompanyId: o.supplierCompanyId, number, uuid: id.uuid, hash: id.hash, qr, lines: inv,
      subtotalHalalas: sub, vatHalalas: vat, totalHalalas: sub + vat, status: autoPay ? 'paid' : issues.length ? 'variance' : 'submitted',
      match: { ok: issues.length === 0, issues }, paidAt: autoPay ? new Date() : null, paymentRef: autoPay ? `AUTO-${number}` : null, autoPaid: autoPay, issuedAt
    }).returning();
    await setStatus(tx, o.id, autoPay ? 'paid' : 'invoiced');
    await orderEvent(tx, o, actorOf(me), `E-invoice ${number} issued (SAR ${((sub + vat) / 100).toFixed(2)} incl. VAT)${autoPay ? '; matched and paid automatically under the auto-pay rule' : ''}`, `صدرت الفاتورة ${number} (${((sub + vat) / 100).toFixed(2)} ر.س شامل الضريبة)${autoPay ? '؛ طوبقت ودُفعت تلقائياً ضمن قاعدة الدفع التلقائي' : ''}`);
    if (autoPay) {
      out.notify(o.supplierCompanyId, rolesFor('supplier', 'invoice.issue'), `${number} paid automatically`, `دُفعت ${number} تلقائياً`, `/app/orders/${o.id}`);
      out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.rate'), `${o.number} paid. Rate the supplier.`, `دُفع ${o.number}. قيّم المورد.`, `/app/orders/${o.id}`);
    } else out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.pay'), `Invoice ${number} from ${me.company.name} ready for matching`, `الفاتورة ${number} من ${me.company.name} جاهزة للمطابقة`, `/app/orders/${o.id}`);
    return ti.id;
  });
  await out.flush();
  return res;
}

export async function payInvoice(me: Me, orderId: string, ref: string) {
  need(me, 'order.pay');
  const out = new Outbox();
  await withTenant(me.company.id, async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'invoiced', 'buyer');
    const [ti] = await tx.select().from(schema.tradeInvoices).where(eq(schema.tradeInvoices.orderId, o.id)).for('update');
    if (!ti || ti.status === 'paid') throw stale();
    if (ti.status === 'variance') throw new OpsError('This invoice has a 3-way match variance. Resolve it (raise a dispute) before paying.', 'في هذه الفاتورة فرق في المطابقة الثلاثية. عالجه (ارفع نزاعاً) قبل الدفع.');
    await tx.update(schema.tradeInvoices).set({ status: 'paid', paidAt: new Date(), paymentRef: ref || `PAY-${ti.number}` }).where(eq(schema.tradeInvoices.id, ti.id));
    await setStatus(tx, o.id, 'paid');
    await orderEvent(tx, o, actorOf(me), `Payment released for ${ti.number} (ref ${ref || `PAY-${ti.number}`})`, `صُرفت دفعة ${ti.number} (مرجع ${ref || `PAY-${ti.number}`})`);
    out.notify(o.supplierCompanyId, rolesFor('supplier', 'invoice.issue'), `Payment released for ${ti.number}`, `صُرفت دفعة ${ti.number}`, `/app/orders/${o.id}`);
    out.notify(o.buyerCompanyId, rolesFor('buyer', 'order.rate'), `${o.number} paid. Rate the supplier.`, `دُفع ${o.number}. قيّم المورد.`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

export async function rateOrder(me: Me, orderId: string, stars: number, tags: string[]) {
  need(me, 'order.rate');
  if (!(stars >= 1 && stars <= 5)) throw new OpsError('Choose 1 to 5 stars.', 'اختر من 1 إلى 5 نجوم.');
  const out = new Outbox();
  await withSystem(async (tx) => {
    const o = await lockOrder(tx, me, orderId, 'paid', 'buyer');
    await setStatus(tx, o.id, 'closed', { rating: stars, ratingTags: tags });
    const [p] = await tx.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.companyId, o.supplierCompanyId)).for('update');
    if (p) {
      const n = p.ratingCount + 1;
      await tx.update(schema.companyProfiles).set({ rating: Math.round(((p.rating * p.ratingCount + stars) / n) * 100) / 100, ratingCount: n, updatedAt: new Date() }).where(eq(schema.companyProfiles.companyId, p.companyId));
    }
    await orderEvent(tx, o, actorOf(me), `Supplier rated ${stars}/5${tags.length ? ` (${tags.join(', ')})` : ''}; order closed`, `قُيّم المورد ${stars}/5؛ أُغلق الطلب`);
    out.notify(o.supplierCompanyId, [], `New rating: ${stars}/5 from ${me.company.name}`, `تقييم جديد: ${stars}/5 من ${me.company.name}`, `/app/orders/${o.id}`);
  });
  await out.flush();
}

// ---------------------------------------------------------------- disputes
export async function raiseDispute(me: Me, orderId: string, type: string, description: string) {
  need(me, 'dispute.raise');
  if (!DISPUTE_TYPES.some((t) => t.id === type)) throw stale();
  if (description.trim().length < 5) throw new OpsError('Describe the problem.', 'صف المشكلة.');
  const out = new Outbox();
  const id = await withTenant(me.company.id, async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    if (!o) throw deny();
    if (!['in_transit', 'delivered', 'received', 'qc_passed', 'invoiced', 'paid', 'closed', 'accepted'].includes(o.status)) throw new OpsError('Disputes can be raised once goods are on the way.', 'يمكن رفع نزاع بعد شحن البضاعة.');
    const [open] = await tx.select().from(schema.disputes).where(and(eq(schema.disputes.orderId, o.id), eq(schema.disputes.status, 'open')));
    if (open) throw new OpsError(`Dispute ${open.number} is already open for this order.`, `النزاع ${open.number} مفتوح بالفعل لهذا الطلب.`);
    const number = await nextNo(tx, 'dispute_seq', 'DSP', 4);
    const t = DISPUTE_TYPES.find((x) => x.id === type)!;
    const [d] = await tx.insert(schema.disputes).values({
      number, orderId: o.id, orderNumber: o.number, buyerCompanyId: o.buyerCompanyId, supplierCompanyId: o.supplierCompanyId, buyerName: o.buyerName, supplierName: o.supplierName,
      raisedByCompanyId: me.company.id, raisedByName: `${me.name} (${me.company.name})`, type, description, slaDueAt: new Date(Date.now() + 48 * 3600_000)
    }).returning();
    await orderEvent(tx, o, actorOf(me), `Dispute ${number} raised: ${t.name.en}`, `رُفع النزاع ${number}: ${t.name.ar}`);
    const other = me.company.id === o.buyerCompanyId ? o.supplierCompanyId : o.buyerCompanyId;
    out.notify(other, ['company_admin'], `Dispute ${number} opened on ${o.number}`, `فُتح النزاع ${number} على ${o.number}`, `/app/orders/${o.id}`);
    return d.id;
  });
  await out.flush();
  return id;
}

export async function resolveDispute(adminName: string, disputeId: string, resolution: string) {
  if (resolution.trim().length < 3) throw new OpsError('Write the resolution.', 'اكتب القرار.');
  const out = new Outbox();
  await withSystem(async (tx) => {
    const [d] = await tx.select().from(schema.disputes).where(eq(schema.disputes.id, disputeId)).for('update');
    if (!d || d.status !== 'open') throw stale();
    await tx.update(schema.disputes).set({ status: 'resolved', resolution, resolvedAt: new Date() }).where(eq(schema.disputes.id, d.id));
    await logEvent(tx, { refType: 'order', refId: d.orderId, buyer: d.buyerCompanyId, supplier: d.supplierCompanyId, actor: { name: adminName, role: 'platform_admin' }, en: `Dispute ${d.number} resolved by Tawreed: ${resolution}`, ar: `حلّت توريد النزاع ${d.number}: ${resolution}` });
    for (const c of [d.buyerCompanyId, d.supplierCompanyId]) out.notify(c, ['company_admin'], `Dispute ${d.number} resolved`, `حُل النزاع ${d.number}`, `/app/orders/${d.orderId}`);
  });
  await out.flush();
}

// ---------------------------------------------------------------- settings
export async function updateLimits(me: Me, d: { threshold: number; autoPay: number; monthly: number }) {
  need(me, 'limits.edit');
  if (![d.threshold, d.autoPay, d.monthly].every((v) => Number.isFinite(v) && v >= 0)) throw new OpsError('Enter valid amounts.', 'أدخل مبالغ صحيحة.');
  await withTenant(me.company.id, async (tx) => {
    await getSettings(tx, me.company.id);
    await tx.update(schema.companySettings).set({ approvalThresholdHalalas: d.threshold, autoPayLimitHalalas: d.autoPay, monthlyLimitHalalas: d.monthly, updatedAt: new Date() }).where(eq(schema.companySettings.companyId, me.company.id));
  });
}

export async function updateSupplierProfile(me: Me, d: { categories: string[]; citiesServed: string[]; localContent: number }) {
  if (me.role !== 'company_admin' || me.company.type !== 'supplier') throw deny();
  if (!(d.localContent >= 0 && d.localContent <= 100)) throw new OpsError('Local content must be 0–100%.', 'المحتوى المحلي بين 0 و100%.');
  await withSystem((tx) => tx.update(schema.companyProfiles).set({ categories: d.categories, citiesServed: d.citiesServed, localContent: Math.round(d.localContent), updatedAt: new Date() }).where(eq(schema.companyProfiles.companyId, me.company.id)));
}

export { carrierQuotes };
