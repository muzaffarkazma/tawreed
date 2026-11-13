import { getAppConfig } from '@config/app.config';

export interface MoyasarPayment {
  id: string;
  status: string; // initiated | paid | failed | authorized | captured | refunded | voided
  amount: number; // halalas
  currency: string;
  description?: string;
  metadata?: Record<string, string> | null;
  source?: { message?: string } | null;
}

/** Fetches a payment from Moyasar with the secret key (server side only). */
export async function fetchMoyasarPayment(id: string): Promise<MoyasarPayment> {
  const { secretKey, apiBase } = getAppConfig().payment.moyasar;
  if (!secretKey) throw new Error('MOYASAR_SECRET_KEY is not set');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) throw new Error('invalid payment id');
  const res = await fetch(`${apiBase}/payments/${encodeURIComponent(id)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Moyasar ${res.status}`);
  return (await res.json()) as MoyasarPayment;
}

export type Verdict = { ok: true } | { ok: false; reason: string };

/** Rules a payment must meet before we activate a subscription. */
export function judgePayment(p: MoyasarPayment, invoice: { id: string; totalHalalas: number }): Verdict {
  if (p.status !== 'paid' && p.status !== 'captured') return { ok: false, reason: p.source?.message || `Payment ${p.status}` };
  if (p.currency !== 'SAR') return { ok: false, reason: 'Wrong currency' };
  if (p.amount !== invoice.totalHalalas) return { ok: false, reason: 'Amount does not match the invoice' };
  if (p.metadata?.invoice_id && p.metadata.invoice_id !== invoice.id) return { ok: false, reason: 'Payment belongs to another invoice' };
  return { ok: true };
}
