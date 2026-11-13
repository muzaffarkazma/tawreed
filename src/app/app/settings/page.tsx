import { withTenant } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { getSettings, monthSpend } from '@/lib/ops/services';
import { limitsAction } from '@/app/actions/ops';
import { Banner, Bar, PageHead, Sar } from '@/components/ops';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['limits.edit'] });
  const sp = await searchParams;
  const { s, spend } = await withTenant(me.company.id, async (tx) => ({ s: await getSettings(tx, me.company.id), spend: await monthSpend(tx, me.company.id) }));
  const sar = (h: number) => (h / 100).toFixed(0);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHead title={L('Limits and approvals', 'الحدود والاعتمادات')} sub={L('Company-wide purchasing rules. Only Finance and the company admin can change them.', 'قواعد الشراء للشركة. تغييرها للمالية ومدير الحساب فقط.')} />
      <Banner err={sp.err} msg={sp.msg ? L('Saved. The new rules apply immediately.', 'تم الحفظ. القواعد الجديدة سارية فوراً.') : undefined} />
      <section className="kpi">
        <div className="flex justify-between text-sm"><span>{L('Spent this month', 'المصروف هذا الشهر')}</span><span><Sar h={spend} lang={lang} /> / <Sar h={s.monthlyLimitHalalas} lang={lang} /></span></div>
        <div className="mt-2"><Bar pct={(spend / Math.max(1, s.monthlyLimitHalalas)) * 100} warn={spend > s.monthlyLimitHalalas * 0.8} /></div>
      </section>
      <form action={limitsAction} className="card space-y-5">
        {([
          ['threshold', s.approvalThresholdHalalas, L('Approval threshold (SAR, excl. VAT)', 'حد الاعتماد (ر.س دون الضريبة)'), L('RFQ awards above this go to Finance for approval. Smaller awards are approved automatically.', 'الترسيات الأعلى تذهب للمالية للاعتماد، والأصغر تُعتمد تلقائياً.')],
          ['autopay', s.autoPayLimitHalalas, L('Auto-pay limit (SAR, incl. VAT)', 'حد الدفع التلقائي (ر.س شامل الضريبة)'), L('Invoices that pass the 3-way match and are at or below this amount are paid automatically.', 'الفواتير المطابقة التي لا تتجاوز هذا المبلغ تُدفع تلقائياً.')],
          ['monthly', s.monthlyLimitHalalas, L('Monthly purchase limit (SAR, incl. VAT)', 'حد الشراء الشهري (ر.س شامل الضريبة)'), L('Market buys and POs that would exceed this in the calendar month are blocked.', 'تُمنع مشتريات السوق وأوامر الشراء التي تتجاوزه خلال الشهر.')]
        ] as const).map(([name, v, label, hint]) => (
          <label key={name} className="block"><span className="label">{label}</span>
            <input className="input max-w-xs" name={name} type="number" min={0} step="1" defaultValue={sar(v)} data-testid={`limit-${name}`} />
            <span className="mt-1 block text-xs text-muted">{hint}</span></label>
        ))}
        <div className="flex justify-end"><button className="btn-pri" data-testid="save-limits">{L('Save rules', 'حفظ القواعد')}</button></div>
      </form>
    </div>
  );
}
