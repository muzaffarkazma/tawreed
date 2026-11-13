import { describe, it, expect } from 'vitest';
import { priceHalalas, formatSar } from '@/lib/billing';
import { judgePayment } from '@/lib/moyasar';

describe('pricing', () => {
  it('adds 15% VAT in halalas', () => {
    expect(priceHalalas({ monthlyHalalas: 450000, yearlyHalalas: 4500000 }, 'monthly')).toEqual({ subtotal: 450000, vat: 67500, total: 517500 });
    expect(priceHalalas({ monthlyHalalas: 450000, yearlyHalalas: 4500000 }, 'yearly').total).toBe(5175000);
  });
  it('formats SAR in both languages', () => {
    expect(formatSar(517500)).toBe('SAR 5,175.00');
    expect(formatSar(517500, 'ar')).toBe('5,175.00 ر.س');
  });
});

describe('Moyasar payment verification', () => {
  const inv = { id: 'inv-1', totalHalalas: 517500 };
  const pay = (o: object) => ({ id: 'pay_1', status: 'paid', amount: 517500, currency: 'SAR', metadata: { invoice_id: 'inv-1' }, ...o });
  it('accepts a paid payment for the exact amount', () => expect(judgePayment(pay({}), inv)).toEqual({ ok: true }));
  it('rejects a failed payment with the gateway message', () => expect(judgePayment(pay({ status: 'failed', source: { message: 'Insufficient funds' } }), inv)).toEqual({ ok: false, reason: 'Insufficient funds' }));
  it('rejects a wrong amount', () => expect(judgePayment(pay({ amount: 100 }), inv).ok).toBe(false));
  it('rejects a wrong currency', () => expect(judgePayment(pay({ currency: 'USD' }), inv).ok).toBe(false));
  it('rejects a payment made for another invoice', () => expect(judgePayment(pay({ metadata: { invoice_id: 'other' } }), inv).ok).toBe(false));
});
