'use server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { markInvoicePaid } from '@/lib/billing';
import { getAppConfig } from '@config/app.config';

/** Bypass mode only: activates the subscription without a card. */
export async function activateBypass(fd: FormData) {
  if (getAppConfig().payment.mode !== 'bypass') throw new Error('Bypass payments are disabled');
  const user = await getCurrentUser();
  if (!user?.company || user.role !== 'company_admin') redirect('/login');
  const invoiceId = String(fd.get('invoiceId') ?? '');
  await withTenant(user.company.id, async (tx) => {
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId));
    if (!inv) throw new Error('Invoice not found');
    await markInvoicePaid(tx, inv.id, { provider: 'bypass', providerPaymentId: `bypass_${inv.id}`, amountHalalas: inv.totalHalalas });
  });
  redirect('/app?activated=1');
}
