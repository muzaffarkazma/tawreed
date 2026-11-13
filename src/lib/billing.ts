import { and, eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { Tx } from '@/db';
import { schema } from '@/db';
import { VAT_RATE } from '@config/plans';
import { audit } from './audit';

export type Cycle = 'monthly' | 'yearly';

export function priceHalalas(plan: { monthlyHalalas: number; yearlyHalalas: number }, cycle: Cycle) {
  const subtotal = cycle === 'yearly' ? plan.yearlyHalalas : plan.monthlyHalalas;
  const vat = Math.round(subtotal * VAT_RATE);
  return { subtotal, vat, total: subtotal + vat };
}

export function formatSar(halalas: number, lang: 'en' | 'ar' = 'en') {
  const v = (halalas / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return lang === 'ar' ? `${v} ر.س` : `SAR ${v}`;
}

export interface SignupInput {
  planId: string;
  cycle: Cycle;
  company: { type: 'buyer' | 'supplier'; name: string; crNumber: string; vatNumber: string; city: string; phone?: string };
  admin: { name: string; email: string; password: string };
}

export class SignupError extends Error {
  constructor(public code: 'plan' | 'email_taken' | 'cr_taken') { super(code); }
}

/** Creates a company (pending payment), its admin user, a pending subscription and a due invoice. */
export async function startSignup(tx: Tx, input: SignupInput) {
  const [plan] = await tx.select().from(schema.plans).where(and(eq(schema.plans.id, input.planId), eq(schema.plans.active, true)));
  if (!plan || plan.audience !== input.company.type) throw new SignupError('plan');

  const email = input.admin.email.trim().toLowerCase();
  const [existingUser] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existingUser) throw new SignupError('email_taken');
  const [existingCo] = await tx.select({ id: schema.companies.id }).from(schema.companies).where(eq(schema.companies.crNumber, input.company.crNumber.trim()));
  if (existingCo) throw new SignupError('cr_taken');

  const [company] = await tx.insert(schema.companies).values({
    type: input.company.type, name: input.company.name.trim(), crNumber: input.company.crNumber.trim(),
    vatNumber: input.company.vatNumber.trim(), city: input.company.city.trim(), phone: input.company.phone?.trim() || null,
    status: 'pending_payment'
  }).returning();

  await tx.insert(schema.companyProfiles).values({ companyId: company.id, type: company.type, name: company.name, city: company.city }).onConflictDoNothing();
  await tx.insert(schema.companySettings).values({ companyId: company.id }).onConflictDoNothing();

  const [admin] = await tx.insert(schema.users).values({
    companyId: company.id, email, name: input.admin.name.trim(),
    passwordHash: await bcrypt.hash(input.admin.password, 10), role: 'company_admin'
  }).returning();

  const [sub] = await tx.insert(schema.subscriptions).values({ companyId: company.id, planId: plan.id, cycle: input.cycle, status: 'pending' }).returning();
  const invoice = await createInvoice(tx, company.id, sub.id, plan, input.cycle);
  await audit(tx, { companyId: company.id, userId: admin.id, action: 'company.signup', entity: 'subscription', entityId: sub.id, data: { planId: plan.id, cycle: input.cycle } });
  return { company, admin, subscription: sub, invoice };
}

export async function createInvoice(tx: Tx, companyId: string, subscriptionId: string, plan: typeof schema.plans.$inferSelect, cycle: Cycle) {
  const p = priceHalalas(plan, cycle);
  const seq = await tx.execute(sql`select nextval('invoice_seq') as n`);
  const n = Number((seq.rows[0] as { n: string }).n);
  const [invoice] = await tx.insert(schema.invoices).values({
    companyId, subscriptionId, number: `INV-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`,
    description: `Tawreed ${plan.nameEn} (${plan.audience}) — ${cycle === 'yearly' ? 'yearly' : 'monthly'} subscription`,
    subtotalHalalas: p.subtotal, vatHalalas: p.vat, totalHalalas: p.total, status: 'due'
  }).returning();
  return invoice;
}

export interface PaymentResult { provider: 'moyasar' | 'bypass'; providerPaymentId: string | null; amountHalalas: number; raw?: unknown }

/** Idempotent: marks the invoice paid and activates subscription + company. */
export async function markInvoicePaid(tx: Tx, invoiceId: string, payment: PaymentResult) {
  const [invoice] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).for('update');
  if (!invoice) throw new Error('invoice_not_found');
  if (invoice.status === 'paid') return { invoice, alreadyPaid: true };
  if (payment.amountHalalas !== invoice.totalHalalas) throw new Error('amount_mismatch');

  await tx.insert(schema.payments).values({
    companyId: invoice.companyId, invoiceId, provider: payment.provider, providerPaymentId: payment.providerPaymentId,
    amountHalalas: payment.amountHalalas, status: 'paid', raw: (payment.raw ?? null) as object | null
  });
  const now = new Date();
  await tx.update(schema.invoices).set({ status: 'paid', paidAt: now }).where(eq(schema.invoices.id, invoiceId));
  const [sub] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, invoice.subscriptionId));
  const end = new Date(now);
  if (sub.cycle === 'yearly') end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
  // a company has one active subscription: cancel any other active one (plan change)
  await tx.update(schema.subscriptions).set({ status: 'cancelled' })
    .where(and(eq(schema.subscriptions.companyId, invoice.companyId), eq(schema.subscriptions.status, 'active')));
  await tx.update(schema.subscriptions).set({ status: 'active', currentPeriodStart: now, currentPeriodEnd: end }).where(eq(schema.subscriptions.id, sub.id));
  await tx.update(schema.companies).set({ status: 'active' })
    .where(and(eq(schema.companies.id, invoice.companyId), sql`${schema.companies.status} <> 'suspended'`));
  await audit(tx, { companyId: invoice.companyId, action: 'invoice.paid', entity: 'invoice', entityId: invoiceId, data: { provider: payment.provider, providerPaymentId: payment.providerPaymentId } });
  return { invoice: { ...invoice, status: 'paid' }, alreadyPaid: false };
}

export async function recordFailedPayment(tx: Tx, invoiceId: string, providerPaymentId: string | null, amount: number, message: string, raw?: unknown) {
  const [invoice] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId));
  if (!invoice) return;
  if (providerPaymentId) {
    const [dup] = await tx.select({ id: schema.payments.id }).from(schema.payments).where(eq(schema.payments.providerPaymentId, providerPaymentId));
    if (dup) return;
  }
  await tx.insert(schema.payments).values({ companyId: invoice.companyId, invoiceId, provider: 'moyasar', providerPaymentId, amountHalalas: amount, status: 'failed', message, raw: (raw ?? null) as object | null });
  await audit(tx, { companyId: invoice.companyId, action: 'invoice.payment_failed', entity: 'invoice', entityId: invoiceId, data: { message } });
}
