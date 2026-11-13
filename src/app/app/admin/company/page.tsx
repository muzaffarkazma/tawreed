import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withTenant, schema } from '@/db';
import { supplierProfileAction } from '@/app/actions/ops';
import { Banner } from '@/components/ops';
import { CATEGORIES, CITIES } from '@/lib/ops/catalog';
import { CompanyForm } from './CompanyForm';

export const dynamic = 'force-dynamic';

export default async function CompanyPage({ searchParams }: { searchParams: Promise<{ err?: string; msg?: string }> }) {
  const me = await requireUser({ roles: ['company_admin'] });
  const { t, lang } = await getT();
  const sp = await searchParams;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const c = me.company!;
  const [p] = await withTenant(c.id, (tx) => tx.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.companyId, c.id)));
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="h1">{t.companyPage.title}</h1>
        <CompanyForm c={{ name: c.name, city: c.city, phone: c.phone ?? '', cr: c.crNumber, vat: c.vatNumber }} t={t} />
      </div>
      {c.type === 'supplier' && p && (
        <section className="card space-y-4" data-testid="supplier-profile">
          <div>
            <h2 className="font-semibold">{L('Network profile', 'الملف في الشبكة')}</h2>
            <p className="mt-1 text-sm text-muted">{L('Buyers are matched to you by these categories and cities. Rating comes from completed orders; verification is done by Tawreed.', 'يُطابقك المشترون حسب هذه الفئات والمدن. التقييم من الطلبات المكتملة، والتوثيق تقوم به توريد.')}</p>
          </div>
          <Banner err={sp.err} msg={sp.msg === 'profile' ? L('Profile saved.', 'تم حفظ الملف.') : undefined} />
          <div className="flex flex-wrap gap-3 text-sm"><span className="pill-mute">★ {p.rating.toFixed(1)} ({p.ratingCount})</span>{p.verified ? <span className="pill-ok">{L('Verified by Tawreed', 'موثّق من توريد')}</span> : <span className="pill-mute">{L('Not verified yet', 'غير موثّق بعد')}</span>}</div>
          <form action={supplierProfileAction} className="space-y-4">
            <fieldset><legend className="label">{L('Categories you supply', 'الفئات التي توردها')}</legend>
              <div className="flex flex-wrap gap-2">{CATEGORIES.filter((x) => x.id !== 'other').map((x) => <label key={x.id} className="cursor-pointer"><input type="checkbox" name="cat" value={x.id} defaultChecked={p.categories.includes(x.id)} className="peer sr-only" /><span className="chip peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-ink">{x.name[lang]}</span></label>)}</div></fieldset>
            <fieldset><legend className="label">{L('Cities you deliver to', 'المدن التي توصل إليها')}</legend>
              <div className="flex flex-wrap gap-2">{CITIES.map((x) => <label key={x.id} className="cursor-pointer"><input type="checkbox" name="city" value={x.id} defaultChecked={p.citiesServed.includes(x.id)} className="peer sr-only" /><span className="chip peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-ink">{x.name[lang]}</span></label>)}</div></fieldset>
            <label className="block max-w-[200px]"><span className="label">{L('Local content (%)', 'المحتوى المحلي (%)')}</span><input className="input" name="lc" type="number" min={0} max={100} defaultValue={p.localContent} /></label>
            <div className="flex justify-end"><button className="btn-pri" data-testid="save-profile">{L('Save profile', 'حفظ الملف')}</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
