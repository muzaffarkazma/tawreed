'use client';
import { useEffect, useRef } from 'react';

declare global { interface Window { Moyasar?: { init: (cfg: Record<string, unknown>) => void } } }

/** Moyasar's hosted card form (served locally from /vendor, from the moyasar-payment-form package). */
export function MoyasarForm(p: { amount: number; description: string; publishableKey: string; callbackUrl: string; invoiceId: string; lang: 'en' | 'ar' }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/vendor/moyasar.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = '/vendor/moyasar.umd.js';
    s.onload = () => window.Moyasar?.init({
      element: '.mysr-form',
      amount: p.amount,
      currency: 'SAR',
      description: p.description,
      publishable_api_key: p.publishableKey,
      callback_url: p.callbackUrl,
      methods: ['creditcard'],
      supported_networks: ['visa', 'mastercard', 'mada'],
      language: p.lang,
      metadata: { invoice_id: p.invoiceId }
    });
    document.body.appendChild(s);
  }, [p]);
  return <div className="mysr-form" data-testid="moyasar-form" />;
}
