import { redirect, notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { formatSar } from '@/lib/billing';
import { getAppConfig } from '@config/app.config';
import { Logo } from '@/components/Logo';
import { LangToggle } from '@/components/LangToggle';
import { activateBypass } from '@/app/actions/checkout';
import { MoyasarForm } from './MoyasarForm';

export const dynamic = 'force-dynamic';

const TEST_CARDS: [string, string, 'ok' | 'bad'][] = [
  ['Visa', '4111 1111 1111 1111', 'ok'],
  ['mada', '4201 3201 1111 1010', 'ok'],
  ['Mastercard', '5421 0801 0100 0000', 'ok'],
  ['Visa', '4123 1200 0000 0000', 'bad']
];

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { t, lang } = await getT();
  const user = await getCurrentUser();
  if (!user?.company) redirect('/login');
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await withTenant(user.company.id, async (tx) => {
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    if (!inv) return null;
    const [sub] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, inv.subscriptionId));
    return { inv, sub };
  });
  if (!data) notFound();
  const { inv } = data;
  if (inv.status === 'paid') redirect('/app');
  const cfg = getAppConfig();
  const mode = cfg.payment.mode;
  const keysOk = !!cfg.payment.moyasar.publishableKey && !!cfg.payment.moyasar.secretKey;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="wrap flex h-16 items-center justify-between"><Logo name={t.brand} sub={t.brandSub} /><LangToggle lang={lang} /></div></header>
      <main className="wrap grid max-w-5xl gap-6 py-10 md:grid-cols-[1fr_1.1fr]">
        <section className="card h-fit" data-testid="invoice-summary">
          <h1 className="text-lg font-semibold">{t.checkout.title}</h1>
          <div className="mt-1 text-sm text-muted">{user.company.name}</div>
          <dl className="mt-5 space-y-2 text-sm">
            <Row k={t.checkout.invoice} v={inv.number} />
            <Row k={inv.description} v="" />
            <Row k={t.checkout.subtotal} v={formatSar(inv.subtotalHalalas, lang)} />
            <Row k={t.checkout.vat} v={formatSar(inv.vatHalalas, lang)} />
            <div className="border-t border-line pt-2"><Row k={t.checkout.total} v={formatSar(inv.totalHalalas, lang)} bold testId="invoice-total" /></div>
          </dl>
        </section>
        <section className="card" data-testid="payment-panel">
          {sp.error && <div className="err mb-4" role="alert" data-testid="payment-error">{t.checkout.failed}: {sp.error}</div>}
          {mode === 'bypass' ? (
            <form action={activateBypass}>
              <input type="hidden" name="invoiceId" value={inv.id} />
              <div className="pill-warn mb-3">{t.checkout.bypassTitle}</div>
              <p className="text-sm text-muted">{t.checkout.bypassBody}</p>
              <button className="btn-pri mt-5 w-full py-2.5" data-testid="activate-bypass">{t.checkout.activate}</button>
            </form>
          ) : !keysOk ? (
            <div className="err">{t.checkout.noKeys}</div>
          ) : (
            <>
              {mode === 'sandbox' && (
                <div className="mb-4 rounded-lg bg-ai-soft p-3 text-sm text-ai" data-testid="test-cards">
                  <div className="font-semibold">{t.checkout.sandboxTitle}</div>
                  <ul className="mt-2 space-y-1 font-mono text-xs" dir="ltr">
                    {TEST_CARDS.map(([n, c, k]) => <li key={c}>{n} {c} — {k === 'ok' ? t.checkout.success : t.checkout.fail}</li>)}
                  </ul>
                  <p className="mt-2 text-xs">{t.checkout.cardNote}</p>
                </div>
              )}
              <MoyasarForm
                amount={inv.totalHalalas}
                description={`${inv.number} ${inv.description}`}
                publishableKey={cfg.payment.moyasar.publishableKey!}
                callbackUrl={`${cfg.appUrl}/api/payments/moyasar/callback?invoice=${inv.id}`}
                invoiceId={inv.id}
                lang={lang}
              />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Row({ k, v, bold, testId }: { k: string; v: string; bold?: boolean; testId?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={bold ? 'font-semibold' : 'text-muted'}>{k}</dt>
      <dd className={`tabular-nums ${bold ? 'font-semibold' : ''}`} data-testid={testId}>{v}</dd>
    </div>
  );
}
