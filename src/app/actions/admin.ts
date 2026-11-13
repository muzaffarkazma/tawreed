'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { createInvoice } from '@/lib/billing';
import { audit } from '@/lib/audit';
import { DICT, getLang } from '@/lib/i18n';

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.company || me.role !== 'company_admin' || me.company.status !== 'active') redirect('/app?denied=1');
  return me as typeof me & { company: NonNullable<typeof me.company> };
}

export interface SimpleState { error?: string; ok?: string }

export async function updateCompanyAction(_p: SimpleState, fd: FormData): Promise<SimpleState> {
  const me = await requireAdmin();
  const t = DICT[await getLang()];
  const p = z.object({ name: z.string().trim().min(2).max(160), city: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional() }).safeParse(Object.fromEntries(fd.entries()));
  if (!p.success) return { error: p.error.issues[0]?.message };
  await withTenant(me.company.id, async (tx) => {
    await tx.update(schema.companies).set({ name: p.data.name, city: p.data.city, phone: p.data.phone || null }).where(eq(schema.companies.id, me.company.id));
    await tx.update(schema.companyProfiles).set({ name: p.data.name, city: p.data.city, updatedAt: new Date() }).where(eq(schema.companyProfiles.companyId, me.company.id));
    await audit(tx, { companyId: me.company.id, userId: me.id, action: 'company.updated', data: p.data });
  });
  revalidatePath('/app', 'layout');
  return { ok: t.companyPage.saved };
}

export async function changePlanAction(fd: FormData) {
  const me = await requireAdmin();
  const planId = String(fd.get('planId'));
  const cycle = fd.get('cycle') === 'yearly' ? 'yearly' : 'monthly';
  const invoiceId = await withTenant(me.company.id, async (tx) => {
    const [plan] = await tx.select().from(schema.plans).where(eq(schema.plans.id, planId));
    if (!plan || plan.audience !== me.company.type || !plan.active) throw new Error('Plan not available');
    const [{ n }] = await tx.select({ n: count() }).from(schema.users).where(and(eq(schema.users.companyId, me.company.id), eq(schema.users.active, true)));
    if (Number(n) > plan.maxUsers) return null;
    // drop earlier unpaid plan changes
    const pending = await tx.select().from(schema.subscriptions).where(and(eq(schema.subscriptions.companyId, me.company.id), eq(schema.subscriptions.status, 'pending')));
    for (const s of pending) {
      await tx.update(schema.subscriptions).set({ status: 'cancelled' }).where(eq(schema.subscriptions.id, s.id));
      await tx.update(schema.invoices).set({ status: 'void' }).where(and(eq(schema.invoices.subscriptionId, s.id), eq(schema.invoices.status, 'due')));
    }
    const [sub] = await tx.insert(schema.subscriptions).values({ companyId: me.company.id, planId, cycle, status: 'pending' }).returning();
    const inv = await createInvoice(tx, me.company.id, sub.id, plan, cycle);
    await audit(tx, { companyId: me.company.id, userId: me.id, action: 'subscription.change_requested', entity: 'subscription', entityId: sub.id, data: { planId, cycle } });
    return inv.id;
  });
  if (!invoiceId) redirect('/app/admin/billing?tooMany=1');
  redirect(`/checkout/${invoiceId}`);
}

