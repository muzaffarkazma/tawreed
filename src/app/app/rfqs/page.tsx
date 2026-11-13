import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, relTime } from '@/lib/ops/page';
import { Empty, Kpi, PageHead, StatusPill, fmtDate } from '@/components/ops';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function RfqsPage() {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['rfq.manage'] });
  const rows = await withTenant(me.company.id, (tx) => tx.select({
    r: schema.rfqs,
    invited: sql<number>`(select count(*) from rfq_invites i where i.rfq_id = ${schema.rfqs.id})`.mapWith(Number),
    quoted: sql<number>`(select count(*) from quotes q where q.rfq_id = ${schema.rfqs.id})`.mapWith(Number),
    questions: sql<number>`(select count(*) from rfq_questions q where q.rfq_id = ${schema.rfqs.id} and q.answer is null)`.mapWith(Number)
  }).from(schema.rfqs).where(eq(schema.rfqs.buyerCompanyId, me.company.id)).orderBy(desc(schema.rfqs.createdAt)).limit(200));
  const now = new Date();
  const by = (s: string[]) => rows.filter((x) => s.includes(x.r.status)).length;
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHead title={L('Requests for quotation', 'طلبات العروض')} sub={L('Sealed bidding with matched suppliers. Quotes open when bidding closes; Tawreed scores them and recommends an award.', 'عروض مختومة مع موردين مطابقين. تُفتح العروض عند الإغلاق، وتقيّمها توريد وتوصي بالترسية.')}
        right={<Link href="/app/requests" className="btn">{L('Start from a request', 'ابدأ من طلب')} →</Link>} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label={L('Bidding open', 'استقبال العروض')} value={by(['open'])} />
        <Kpi label={L('To evaluate', 'للتقييم')} value={by(['evaluation'])} />
        <Kpi label={L('With Finance', 'لدى المالية')} value={by(['pending_approval'])} />
        <Kpi label={L('PO issued', 'صدر أمر الشراء')} value={by(['ordered'])} />
      </div>
      {!rows.length ? <Empty title={L('No RFQs yet', 'لا توجد طلبات عروض')} body={L('Open a request and choose "Send to RFQ". Tawreed matches suppliers by category, city, rating and local content.', 'افتح طلباً واختر "إرسال كطلب عروض". تطابق توريد الموردين حسب الفئة والمدينة والتقييم والمحتوى المحلي.')} cta={<Link className="btn-pri" href="/app/requests">{L('Go to requests', 'اذهب إلى الطلبات')}</Link>} /> : (
        <div className="card overflow-x-auto p-0">
          <table className="tbl" data-testid="rfqs-table">
            <thead><tr><th>RFQ</th><th>{L('Quotes', 'العروض')}</th><th>{L('Deadline', 'المهلة')}</th><th>{L('Questions', 'الأسئلة')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
            <tbody>{rows.map(({ r, invited, quoted, questions }) => (
              <tr key={r.id} data-testid={`rfq-${r.number}`}>
                <td><Link href={`/app/rfqs/${r.id}`} className="font-medium text-brand-ink hover:underline">{r.number}</Link><div className="max-w-xs truncate text-xs text-muted">{r.title}</div></td>
                <td className="num">{quoted} / {invited}</td>
                <td className="text-xs">{fmtDate(r.deadline, lang, true)}{r.status === 'open' && <div className={r.deadline < now ? 'text-bad' : 'text-muted'}>{relTime(r.deadline, lang)}</div>}</td>
                <td>{questions ? <span className="pill-warn">{questions}</span> : <span className="text-muted">—</span>}</td>
                <td><StatusPill kind="rfq" status={r.status === 'open' && r.deadline < now ? 'evaluation' : r.status} lang={lang} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
