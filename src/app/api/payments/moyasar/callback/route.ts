import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { withSystem, schema } from '@/db';
import { fetchMoyasarPayment, judgePayment } from '@/lib/moyasar';
import { markInvoicePaid, recordFailedPayment } from '@/lib/billing';
import { getAppConfig } from '@config/app.config';

export const dynamic = 'force-dynamic';

/**
 * Moyasar redirects the customer here after the card step: ?invoice=<our id>&id=<payment id>&status=...
 * We never trust the query string: the payment is fetched from Moyasar with the secret key and checked.
 */
export async function GET(req: NextRequest) {
  const base = getAppConfig().appUrl;
  const invoiceId = req.nextUrl.searchParams.get('invoice') ?? '';
  const paymentId = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(invoiceId) || !paymentId) return NextResponse.redirect(new URL('/pricing', base));

  const invoice = await withSystem(async (tx) => (await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)))[0]);
  if (!invoice) return NextResponse.redirect(new URL('/pricing', base));
  if (invoice.status === 'paid') return NextResponse.redirect(new URL('/app?activated=1', base));

  let payment;
  try {
    payment = await fetchMoyasarPayment(paymentId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'verification failed';
    return NextResponse.redirect(new URL(`/checkout/${invoiceId}?error=${encodeURIComponent(msg)}`, base));
  }
  const verdict = judgePayment(payment, invoice);
  if (!verdict.ok) {
    await withSystem((tx) => recordFailedPayment(tx, invoiceId, payment.id, payment.amount ?? 0, verdict.reason, payment));
    return NextResponse.redirect(new URL(`/checkout/${invoiceId}?error=${encodeURIComponent(verdict.reason)}`, base));
  }
  await withSystem((tx) => markInvoicePaid(tx, invoiceId, { provider: 'moyasar', providerPaymentId: payment.id, amountHalalas: payment.amount, raw: payment }));
  return NextResponse.redirect(new URL('/app?activated=1', base));
}
