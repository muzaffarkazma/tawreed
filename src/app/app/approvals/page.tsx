import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { getSettings, monthSpend } from '@/lib/ops/services';
import { approvalAction } from '@/app/actions/ops';
import { AIBox, ActionPanel, Banner, Bar, Empty, PageHead, Sar, StatusPill, fmtDate } from '@/components/ops';
import { AskAI } from '@/components/AskAI';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['approval.decide'] });
  const sp = await searchParams;
  const d = await withTenant(me.company.id, async (tx) => {
    const rows = await tx.select({ a: schema.approvals, r: schema.rfqs }).from(schema.approvals).innerJoin(schema.rfqs, eq(schema.rfqs.id, schema.approvals.rfqId))
      .where(eq(schema.approvals.buyerCompanyId, me.company.id)).orderBy(desc(schema.approvals.createdAt)).limit(100);
    const users = await tx.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.companyId, me.company.id));
    return { rows, users, settings: await getSettings(tx, me.company.id), spend: await monthSpend(tx, me.company.id) };
  });
  const name = (id: string | null) => d.users.find((u) => u.id === id)?.name ?? '—';
  const pending = d.rows.filter((x) => x.a.status === 'pending');
  const done = d.rows.filter((x) => x.a.status !== 'pending');
  const lim = d.settings.monthlyLimitHalalas;
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <PageHead title={L('Approvals', 'الاعتمادات')} sub={L('Awards above your approval threshold wait here for Finance.', 'الترسيات الأعلى من حد الاعتماد تنتظر المالية هنا.')}
        right={<Link href="/app/settings" className="btn btn-sm">{L('Limits and rules', 'الحدود والقواعد')}</Link>} />
      <Banner err={sp.err} msg={sp.msg === 'approve' ? L('Approved. Procurement can now issue the PO.', 'تم الاعتماد. يمكن للمشتريات إصدار أمر الشراء.') : sp.msg === 'return' ? L('Returned to procurement with your comment.', 'أُعيد للمشتريات مع ملاحظتك.') : undefined} />
      <div className="kpi">
        <div className="flex justify-between text-xs text-muted"><span>{L('Spent this month', 'المصروف هذا الشهر')}</span><span><Sar h={d.spend} lang={lang} /> / <Sar h={lim} lang={lang} /></span></div>
        <div className="mt-2"><Bar pct={(d.spend / Math.max(1, lim)) * 100} warn={d.spend / Math.max(1, lim) > 0.8} /></div>
        <div className="mt-1 text-xs text-muted">{L('Approval threshold', 'حد الاعتماد')}: <Sar h={d.settings.approvalThresholdHalalas} lang={lang} /> {L('excl. VAT', 'دون الضريبة')}</div>
      </div>
      {!pending.length && <Empty title={L('Nothing waiting for approval', 'لا شيء بانتظار الاعتماد')} body={L('When procurement awards above the threshold, it will appear here and you will be notified.', 'عندما ترسي المشتريات فوق الحد سيظهر هنا وتصلك رسالة.')} />}
      {pending.map(({ a, r }) => {
        const after = d.spend + a.amountHalalas;
        return (
          <div key={a.id} data-testid={`approval-${r.number}`}>
            {/* inputs below attach to this form via the form= attribute, so the AI button's own form is not nested */}
            <form id={`apf-${a.id}`} action={approvalAction}><input type="hidden" name="approvalId" value={a.id} /></form>
            <ActionPanel lang={lang} title={<>{L('Approve award', 'اعتماد الترسية')} · {r.number}</>}
              footer={<><button form={`apf-${a.id}`} className="btn-danger" name="decision" value="return" data-testid="approval-return">{L('Return with comment', 'إعادة مع ملاحظة')}</button><button form={`apf-${a.id}`} className="btn-pri" name="decision" value="approve" data-testid="approval-approve">{L('Approve', 'اعتماد')}</button></>}>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div><div className="text-xs text-muted">{L('Supplier', 'المورد')}</div><b><bdi>{a.supplierName}</bdi></b></div>
                <div><div className="text-xs text-muted">{L('Amount incl. VAT', 'المبلغ شامل الضريبة')}</div><b><Sar h={a.amountHalalas} lang={lang} /></b></div>
                <div><div className="text-xs text-muted">{L('Requested by', 'طلبه')}</div>{name(a.requestedBy)} · {fmtDate(a.createdAt, lang, true)}</div>
              </div>
              <div className="rounded-lg bg-canvas p-3 text-sm"><div className="label">{L('Procurement justification', 'مبرر المشتريات')}</div>{a.justification || '—'}</div>
              <AIBox auto title={L('Budget check', 'فحص الميزانية')}>
                {after > d.settings.monthlyLimitHalalas
                  ? L(`Issuing this PO would take monthly spend to SAR ${(after / 100).toLocaleString('en-US')}, above the SAR ${(lim / 100).toLocaleString('en-US')} limit. Raise the limit first or return the award.`, `إصدار أمر الشراء سيرفع المصروف الشهري إلى ${(after / 100).toLocaleString('en-US')} ر.س، فوق الحد ${(lim / 100).toLocaleString('en-US')} ر.س. ارفع الحد أولاً أو أعد الترسية.`)
                  : L(`Within budget: monthly spend after this PO will be SAR ${(after / 100).toLocaleString('en-US')} of SAR ${(lim / 100).toLocaleString('en-US')} (${Math.round((after / lim) * 100)}%).`, `ضمن الميزانية: المصروف الشهري بعد أمر الشراء ${(after / 100).toLocaleString('en-US')} من ${(lim / 100).toLocaleString('en-US')} ر.س (${Math.round((after / lim) * 100)}%).`)}
                <div className="mt-2"><AskAI kind="approval" refId={a.id} label={L('Ask AI for a risk summary', 'اطلب ملخص المخاطر من الذكاء الاصطناعي')} title={L('AI risk summary', 'ملخص المخاطر')} busy="…" /></div>
              </AIBox>
              <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/app/rfqs/${r.id}`} className="text-sm font-medium text-brand-ink hover:underline">{L('Open the quote comparison', 'افتح مقارنة العروض')} →</Link></div>
              <label className="block"><span className="label">{L('Comment (required to return)', 'ملاحظة (مطلوبة عند الإعادة)')}</span><input form={`apf-${a.id}`} name="comment" className="input" data-testid="approval-comment" /></label>
            </ActionPanel>
          </div>
        );
      })}
      {done.length > 0 && (
        <section className="card overflow-x-auto p-0">
          <div className="px-4 pt-4 font-semibold">{L('History', 'السجل')}</div>
          <table className="tbl mt-2"><thead><tr><th>RFQ</th><th>{L('Supplier', 'المورد')}</th><th>{L('Amount', 'المبلغ')}</th><th>{L('Decision', 'القرار')}</th><th>{L('By', 'بواسطة')}</th></tr></thead>
            <tbody>{done.map(({ a, r }) => <tr key={a.id}><td><Link className="text-brand-ink hover:underline" href={`/app/rfqs/${r.id}`}>{r.number}</Link></td><td><bdi>{a.supplierName}</bdi></td><td><Sar h={a.amountHalalas} lang={lang} /></td><td><StatusPill kind="approval" status={a.status} lang={lang} />{a.comment && <div className="text-xs text-muted">{a.comment}</div>}</td><td className="text-xs">{name(a.decidedBy)}<div className="text-muted">{fmtDate(a.decidedAt, lang, true)}</div></td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  );
}
