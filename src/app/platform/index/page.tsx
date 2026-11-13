import { asc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withSystem, schema } from '@/db';
import { overrideIndexAction } from '@/app/actions/platform';
import { Banner, PageHead, Sar, tr, fmtDate } from '@/components/ops';
import { Spark } from '@/components/Spark';
import { categoryName, cityName } from '@/lib/ops/catalog';

export const dynamic = 'force-dynamic';

export default async function PlatformIndex({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireUser({ platform: true });
  const { lang } = await getT();
  const L = tr(lang);
  const sp = await searchParams;
  const rows = await withSystem((tx) => tx.select().from(schema.priceIndex).orderBy(asc(schema.priceIndex.category), asc(schema.priceIndex.key)));
  return (
    <div className="space-y-6">
      <PageHead title={L('Tawreed price index', 'مؤشر توريد للأسعار')} sub={L('The benchmark every buyer sees next to quotes and offers. It moves with each trade (90% previous value, 10% new price). Pin a value to stop automatic updates; clear it to resume.', 'المرجع الذي يراه كل مشترٍ بجانب العروض. يتحرك مع كل صفقة (90% القيمة السابقة و10% السعر الجديد). ثبّت قيمة لإيقاف التحديث التلقائي، وامسحها للاستئناف.')} />
      <Banner msg={sp.msg ? L('Index updated.', 'تم تحديث المؤشر.') : undefined} />
      <section className="card overflow-x-auto p-0">
        <table className="tbl" data-testid="index-table">
          <thead><tr><th>{L('Item', 'الصنف')}</th><th>{L('City', 'المدينة')}</th><th>{L('Value', 'القيمة')}</th><th>{L('Trend', 'الاتجاه')}</th><th>{L('Trades', 'الصفقات')}</th><th>{L('Updated', 'آخر تحديث')}</th><th>{L('Pin value (SAR)', 'تثبيت قيمة (ر.س)')}</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.key} data-testid={`idx-${r.key}`}>
              <td><div className="font-medium">{lang === 'ar' ? r.itemAr : r.itemEn}</div><div className="text-xs text-muted">{categoryName(r.category, lang)} · {L('per', 'لكل')} {lang === 'ar' ? r.unitAr : r.unitEn}</div></td>
              <td>{cityName(r.city, lang)}</td>
              <td><Sar h={r.valueHalalas} lang={lang} className="font-semibold" /> <span className={`text-xs ${r.changePct > 0 ? 'text-bad' : 'text-ok'}`}>{r.changePct > 0 ? '▲' : '▼'} {Math.abs(r.changePct)}%</span>{r.overridden && <span className="pill-warn ms-1">{L('Pinned', 'مثبّت')}</span>}</td>
              <td><Spark values={r.history} /></td>
              <td className="num">{r.sourceCount}</td>
              <td className="text-xs text-muted">{fmtDate(r.updatedAt, lang, true)}</td>
              <td>
                <form action={overrideIndexAction} className="flex gap-1">
                  <input type="hidden" name="key" value={r.key} />
                  <input className="input w-24 py-1 text-sm" name="value" inputMode="decimal" placeholder={r.overridden ? L('clear', 'مسح') : (r.valueHalalas / 100).toFixed(2)} />
                  <button className="btn btn-sm">{L('Save', 'حفظ')}</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}
