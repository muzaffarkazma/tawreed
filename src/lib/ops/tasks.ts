import 'server-only';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import type { CurrentUser } from '@/lib/auth';
import { can } from './core';
import { ORDER_FLOW } from './flow';
import type { Bi } from './catalog';

export interface Task { key: string; action: Bi; ref: string; title: string; href: string; at: Date; tone: 'warn' | 'info' }
type Me = CurrentUser & { company: NonNullable<CurrentUser['company']> };

/** Everything waiting on the signed-in user's role, newest first. This is the live "your turn" inbox. */
export async function myTasks(me: Me): Promise<Task[]> {
  const c = me.company;
  return withTenant(c.id, async (tx) => {
    const t: Task[] = [];
    const now = new Date();
    if (c.type === 'buyer') {
      if (can(me, 'request.triage')) {
        for (const r of await tx.select().from(schema.requests).where(and(eq(schema.requests.buyerCompanyId, c.id), eq(schema.requests.status, 'submitted'))).orderBy(desc(schema.requests.createdAt)).limit(20))
          t.push({ key: r.id, action: { en: 'Triage: buy from market or send to RFQ', ar: 'الفرز: الشراء من السوق أو طلب عروض' }, ref: r.number, title: r.title, href: `/app/requests/${r.id}`, at: r.createdAt, tone: 'warn' });
      }
      if (can(me, 'rfq.manage')) {
        for (const r of await tx.select().from(schema.rfqs).where(and(eq(schema.rfqs.buyerCompanyId, c.id), inArray(schema.rfqs.status, ['open', 'evaluation', 'approved']))).limit(30)) {
          if (r.status === 'open' && r.deadline > now) continue;
          const action = r.status === 'approved' ? { en: 'Issue the purchase order', ar: 'إصدار أمر الشراء' } : { en: 'Compare quotes and award', ar: 'مقارنة العروض والترسية' };
          t.push({ key: r.id, action, ref: r.number, title: r.title, href: `/app/rfqs/${r.id}`, at: r.createdAt, tone: 'warn' });
        }
        for (const q of await tx.select({ q: schema.rfqQuestions, n: schema.rfqs.number }).from(schema.rfqQuestions).innerJoin(schema.rfqs, eq(schema.rfqs.id, schema.rfqQuestions.rfqId))
          .where(and(eq(schema.rfqQuestions.buyerCompanyId, c.id), sql`${schema.rfqQuestions.answer} is null`, eq(schema.rfqs.status, 'open'))).limit(20))
          t.push({ key: q.q.id, action: { en: 'Answer a supplier question', ar: 'الرد على سؤال مورد' }, ref: q.n, title: q.q.question, href: `/app/rfqs/${q.q.rfqId}`, at: q.q.createdAt, tone: 'info' });
      }
      if (can(me, 'approval.decide')) {
        for (const a of await tx.select({ a: schema.approvals, n: schema.rfqs.number }).from(schema.approvals).innerJoin(schema.rfqs, eq(schema.rfqs.id, schema.approvals.rfqId)).where(and(eq(schema.approvals.buyerCompanyId, c.id), eq(schema.approvals.status, 'pending'))))
          t.push({ key: a.a.id, action: { en: 'Approve the award', ar: 'اعتماد الترسية' }, ref: a.n, title: a.a.supplierName, href: '/app/approvals', at: a.a.createdAt, tone: 'warn' });
      }
    } else {
      if (can(me, 'quote.submit')) {
        for (const r of await tx.select({ i: schema.rfqInvites, r: schema.rfqs }).from(schema.rfqInvites).innerJoin(schema.rfqs, eq(schema.rfqs.id, schema.rfqInvites.rfqId))
          .where(and(eq(schema.rfqInvites.supplierCompanyId, c.id), inArray(schema.rfqInvites.status, ['invited', 'viewed']), eq(schema.rfqs.status, 'open'), gt(schema.rfqs.deadline, now))))
          t.push({ key: r.i.id, action: { en: 'Submit a quotation', ar: 'تقديم عرض سعر' }, ref: r.r.number, title: `${r.r.buyerName} · ${r.r.title}`, href: `/app/opportunities/${r.r.id}`, at: r.i.createdAt, tone: 'warn' });
        for (const q of await tx.select().from(schema.quotes).where(and(eq(schema.quotes.supplierCompanyId, c.id), sql`${schema.quotes.negotiation}->>'status' = 'pending'`)))
          t.push({ key: q.id, action: { en: 'Respond to a price request', ar: 'الرد على طلب خفض السعر' }, ref: `-${q.negotiation?.targetPct}%`, title: q.supplierName, href: `/app/opportunities/${q.rfqId}`, at: q.submittedAt, tone: 'warn' });
      }
      if (can(me, 'offer.manage')) {
        for (const co of await tx.select({ c: schema.counterOffers, n: schema.offers.number, item: schema.offers.item }).from(schema.counterOffers).innerJoin(schema.offers, eq(schema.offers.id, schema.counterOffers.offerId)).where(and(eq(schema.counterOffers.supplierCompanyId, c.id), eq(schema.counterOffers.status, 'pending'))))
          t.push({ key: co.c.id, action: { en: 'Respond to a counter-offer', ar: 'الرد على سعر مقابل' }, ref: co.n, title: `${co.c.buyerName} · ${co.item}`, href: '/app/offers', at: co.c.createdAt, tone: 'warn' });
      }
    }
    // orders: every status whose turn belongs to this company and this role
    const side = c.type;
    const steps = ORDER_FLOW.filter((s) => s.side === side && can(me, s.perm));
    if (steps.length) {
      const col = side === 'buyer' ? schema.orders.buyerCompanyId : schema.orders.supplierCompanyId;
      for (const o of await tx.select().from(schema.orders).where(and(eq(col, c.id), inArray(schema.orders.status, steps.map((s) => s.status)))).orderBy(desc(schema.orders.updatedAt)).limit(40)) {
        const st = steps.find((s) => s.status === o.status)!;
        t.push({ key: o.id, action: st.action, ref: o.number, title: side === 'buyer' ? o.supplierName : o.buyerName, href: `/app/orders/${o.id}`, at: o.updatedAt, tone: 'warn' });
      }
    }
    return t.sort((a, b) => +b.at - +a.at);
  });
}

export async function unreadCount(me: Me) {
  return withTenant(me.company.id, async (tx) => {
    const [seen] = await tx.select().from(schema.notificationReads).where(eq(schema.notificationReads.userId, me.id));
    const since = seen?.seenAt ?? new Date(0);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.notifications)
      .where(and(eq(schema.notifications.companyId, me.company.id), gt(schema.notifications.createdAt, since), sql`(cardinality(${schema.notifications.roles}) = 0 or ${me.role} = any(${schema.notifications.roles}))`));
    return n;
  });
}

export async function myNotifications(me: Me, limit = 50) {
  return withTenant(me.company.id, async (tx) => {
    const [seen] = await tx.select().from(schema.notificationReads).where(eq(schema.notificationReads.userId, me.id));
    const rows = await tx.select().from(schema.notifications)
      .where(and(eq(schema.notifications.companyId, me.company.id), sql`(cardinality(${schema.notifications.roles}) = 0 or ${me.role} = any(${schema.notifications.roles}))`))
      .orderBy(desc(schema.notifications.id)).limit(limit);
    return rows.map((r) => ({ ...r, unread: !seen || r.createdAt > seen.seenAt }));
  });
}

