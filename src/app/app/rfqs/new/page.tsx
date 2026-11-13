import { redirect, notFound } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, isUuid } from '@/lib/ops/page';
import { supplierDirectory } from '@/lib/ops/services';
import { matchSuppliers } from '@/lib/ops/matching';
import { createRfqAction } from '@/app/actions/ops';
import { AIBox, ActionPanel, Banner, PageHead, Sar, fmtQty } from '@/components/ops';
import { cityName, unitName, categoryName } from '@/lib/ops/catalog';

export const dynamic = 'force-dynamic';

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ request?: string; err?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['rfq.manage'] });
  const sp = await searchParams;
  if (!isUuid(sp.request)) redirect('/app/requests');
  const d = await withTenant(me.company.id, async (tx) => {
    const [r] = await tx.select().from(schema.requests).where(eq(schema.requests.id, sp.request!));
    if (!r) return null;
    const lines = await tx.select().from(schema.requestLines).where(and(eq(schema.requestLines.requestId, r.id), isNull(schema.requestLines.route))).orderBy(asc(schema.requestLines.lineNo));
    return { r, lines, dir: await supplierDirectory(tx) };
  });
  if (!d) notFound();
  if (!d.lines.length) redirect(`/app/requests/${d.r.id}`);
  const matches = matchSuppliers(d.lines.map((l) => l.category), d.r.deliveryCity, d.dir);
  const pre = new Set(matches.filter((m) => m.score >= 50).slice(0, 5).map((m) => m.profile.companyId));
  if (!pre.size) matches.slice(0, 3).forEach((m) => pre.add(m.profile.companyId));
  const est = d.lines.reduce((s, l) => s + Math.round(l.qty * l.estUnitHalalas), 0);
  return (
    <div className="max-w-5xl space-y-5">
      <PageHead back={{ href: `/app/requests/${d.r.id}`, label: d.r.number }} title={L('Publish an RFQ', 'نشر طلب عروض')} sub={<>{d.r.title} · {cityName(d.r.deliveryCity, lang)}</>} />
      <Banner err={sp.err} />
      <form action={createRfqAction}>
        <input type="hidden" name="requestId" value={d.r.id} />
        <ActionPanel lang={lang} title={L('Choose lines, suppliers and deadline', 'اختر البنود والموردين والمهلة')} footer={<button className="btn-pri" data-testid="publish-rfq">{L('Publish sealed RFQ', 'نشر طلب العروض المختوم')}</button>}>
          <div>
            <div className="label">{L('Lines in this RFQ', 'بنود طلب العروض')}</div>
            <div className="divide-y divide-line rounded-lg border border-line">
              {d.lines.map((l) => (
                <label key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" name="line" value={l.id} defaultChecked className="h-4 w-4 accent-brand" />
                  <span className="flex-1"><b>{l.item}</b> <span className="text-muted">{l.spec}</span></span>
                  <span className="num text-xs text-muted">{fmtQty(l.qty)} {unitName(l.unit, lang)} · {categoryName(l.category, lang)}</span>
                </label>
              ))}
            </div>
            <div className="mt-1 text-xs text-muted">{L('Estimated value', 'القيمة التقديرية')}: <Sar h={est} lang={lang} /> {L('excl. VAT', 'دون الضريبة')}</div>
          </div>
          <AIBox auto title={L('Supplier matching', 'مطابقة الموردين')} testId="supplier-match">
            {L(`${matches.length} suppliers on Tawreed cover these categories. Score = category coverage 55 + serves ${d.r.deliveryCity} 15 + rating 15 + local content 10 + verified 5. The best matches are pre-selected.`, `${matches.length} موردين على توريد يغطون هذه الفئات. الدرجة = تغطية الفئات 55 + يخدم ${cityName(d.r.deliveryCity, 'ar')} 15 + التقييم 15 + المحتوى المحلي 10 + التوثيق 5. تم اختيار الأفضل مسبقاً.`)}
          </AIBox>
          <div className="divide-y divide-line rounded-lg border border-line" data-testid="supplier-list">
            {matches.map((m) => (
              <label key={m.profile.companyId} className="flex items-center gap-3 px-3 py-2.5 text-sm" data-testid={`sup-${m.profile.name}`}>
                <input type="checkbox" name="sup" value={m.profile.companyId} defaultChecked={pre.has(m.profile.companyId)} className="h-4 w-4 accent-brand" />
                <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-semibold text-brand-ink num">{m.score}</span>
                <span className="min-w-0 flex-1"><b><bdi>{m.profile.name}</bdi></b>{m.profile.verified && <span className="pill-ok ms-2">{L('Verified', 'موثّق')}</span>}<div className="truncate text-xs text-muted">{lang === 'ar' ? m.reasonAr : m.reasonEn}</div></span>
              </label>
            ))}
            {!matches.length && <div className="p-3 text-sm text-muted">{L('No supplier covers these categories yet.', 'لا يوجد مورد يغطي هذه الفئات بعد.')}</div>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">{L('Bidding closes in', 'تُغلق العروض خلال')}</span>
              <select name="deadline" className="input" defaultValue="48" data-testid="rfq-deadline">
                {[[2, L('2 hours', 'ساعتين')], [24, L('24 hours', '24 ساعة')], [48, L('48 hours', '48 ساعة')], [72, L('3 days', '3 أيام')], [168, L('7 days', '7 أيام')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <label><span className="label">{L('Commercial terms', 'الشروط التجارية')}</span><input name="terms" className="input" defaultValue={L('Delivered to site (DAP), payment Net 30', 'التسليم في الموقع (DAP)، الدفع خلال 30 يوماً')} /></label>
          </div>
        </ActionPanel>
      </form>
    </div>
  );
}
