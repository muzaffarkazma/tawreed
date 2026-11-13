'use client';
import { useActionState, useEffect, useState } from 'react';
import { structureAction, createRequestAction, type StructureState } from '@/app/actions/ops';
import type { DraftLine } from '@/lib/ops/structure';

type Opt = { id: string; name: string };
const EXAMPLE = { en: 'For the Al-Nakheel tower site: 400 bags of OPC cement, 12 tons of 16 mm rebar Grade 60 and 120 safety helmets EN 397. Deliver to Riyadh before the end of the month.', ar: 'لموقع برج النخيل: 400 كيس أسمنت بورتلاندي، و12 طن حديد تسليح 16 مم درجة 60، و120 خوذة سلامة EN 397. التسليم في الرياض قبل نهاية الشهر.' };

export function NewRequestForm({ lang, defaultCity, cities, units, categories }: { lang: 'en' | 'ar'; defaultCity: string; cities: Opt[]; units: Opt[]; categories: Opt[] }) {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [st, structure, pending] = useActionState<StructureState, FormData>(structureAction, {});
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [desc, setDesc] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [cc, setCc] = useState('');
  const [needBy, setNeedBy] = useState('');
  const [by, setBy] = useState('manual');
  useEffect(() => {
    if (st.lines) {
      setLines(st.lines); setBy(st.by ?? 'rules');
      if (!title) setTitle(st.lines.slice(0, 3).map((l) => l.item).join(', ').slice(0, 120));
    }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (i: number, k: keyof DraftLine, v: string) => setLines((ls) => ls.map((l, j) => j !== i ? l : { ...l, [k]: k === 'qty' ? Number(v) : k === 'estUnitHalalas' ? Math.round(Number(v) * 100) : v, ...(k === 'item' || k === 'unit' ? { indexKey: null } : {}) }));
  const total = lines.reduce((s, l) => s + Math.round((Number(l.qty) || 0) * (l.estUnitHalalas || 0)), 0);
  const fmt = (h: number) => `${(h / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${L('SAR', 'ر.س')}`;
  const payload = JSON.stringify({ title, description: desc, project, costCenter: cc, city, needBy, by, lines });
  return (
    <div className="space-y-5">
      <form action={structure} className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="label mb-0" htmlFor="desc">{L('What do you need?', 'ما الذي تحتاجه؟')}</label>
          <button type="button" className="text-xs font-medium text-brand-ink hover:underline" onClick={() => setDesc(EXAMPLE[lang])} data-testid="use-example">{L('Use an example', 'استخدم مثالاً')}</button>
        </div>
        <textarea id="desc" name="description" className="input min-h-[110px]" value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="req-desc"
          placeholder={L('e.g. 400 bags of cement, 12 tons of 16 mm rebar and 120 helmets for the Riyadh site', 'مثال: 400 كيس أسمنت و12 طن حديد 16 مم و120 خوذة لموقع الرياض')} />
        <input type="hidden" name="city" value={city} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn border-ai-line bg-ai-soft text-ai hover:bg-ai-soft" disabled={pending} data-testid="structure">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /></svg>
            {pending ? L('Structuring…', 'جارٍ التحليل…') : L('Structure with AI', 'حلّل بالذكاء الاصطناعي')}
          </button>
          <button type="button" className="btn" onClick={() => setLines((l) => [...l, { item: '', spec: '', qty: 1, unit: 'pcs', category: 'other', indexKey: null, estUnitHalalas: 0 }])} data-testid="add-line">+ {L('Add a line manually', 'أضف بنداً يدوياً')}</button>
        </div>
        {st.error && <div className="err" data-testid="structure-error">{st.error}</div>}
      </form>

      {st.lines && (
        <div className="ai" data-testid="structure-result">
          <div className="ai-h"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /></svg>
            {L(`Found ${st.lines.length} line items`, `تم العثور على ${st.lines.length} بنود`)}<span className="ms-auto font-normal opacity-75">{st.by === 'rules' ? L('built-in parser (no AI provider set)', 'المحلل المدمج (لا يوجد مزود ذكاء اصطناعي)') : st.by}</span></div>
          <div>{L('Prices are estimates from the Tawreed index for your delivery city. Check quantities and specs, then submit.', 'الأسعار تقديرية من مؤشر توريد لمدينة التسليم. راجع الكميات والمواصفات ثم أرسل.')}</div>
          {!!st.notes?.length && <ul className="mt-1 list-disc ps-5 text-xs">{st.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      )}

      {lines.length > 0 && (
        <form action={createRequestAction} className="space-y-5">
          <input type="hidden" name="payload" value={payload} />
          <section className="card overflow-x-auto p-0">
            <table className="tbl min-w-[760px]" data-testid="draft-lines">
              <thead><tr><th>#</th><th>{L('Item', 'الصنف')}</th><th>{L('Specification', 'المواصفات')}</th><th>{L('Qty', 'الكمية')}</th><th>{L('Unit', 'الوحدة')}</th><th>{L('Category', 'الفئة')}</th><th>{L('Est. unit price (SAR)', 'سعر الوحدة التقديري')}</th><th></th></tr></thead>
              <tbody>{lines.map((l, i) => (
                <tr key={i} data-testid={`draft-line-${i}`}>
                  <td className="num text-muted">{i + 1}</td>
                  <td><input className="input py-1.5" value={l.item} onChange={(e) => set(i, 'item', e.target.value)} required data-testid={`line-item-${i}`} /></td>
                  <td><input className="input py-1.5" value={l.spec} onChange={(e) => set(i, 'spec', e.target.value)} /></td>
                  <td><input className="input w-24 py-1.5" type="number" min="0.001" step="any" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} required data-testid={`line-qty-${i}`} /></td>
                  <td><select className="input py-1.5" value={l.unit} onChange={(e) => set(i, 'unit', e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td><select className="input py-1.5" value={l.category} onChange={(e) => set(i, 'category', e.target.value)}>{categories.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td><input className="input w-28 py-1.5" type="number" min="0" step="0.01" value={(l.estUnitHalalas / 100).toString()} onChange={(e) => set(i, 'estUnitHalalas', e.target.value)} />{l.indexKey && <div className="mt-0.5 text-[10.5px] text-ai">{L('Tawreed index', 'مؤشر توريد')}</div>}</td>
                  <td><button type="button" className="text-xs text-bad hover:underline" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>{L('Remove', 'حذف')}</button></td>
                </tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={6} className="px-3 py-2.5 text-end text-sm font-medium">{L('Estimated total (excl. VAT)', 'الإجمالي التقديري (دون الضريبة)')}</td><td className="num px-3 font-semibold" data-testid="draft-total">{fmt(total)}</td><td /></tr></tfoot>
            </table>
          </section>
          <section className="card grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="label">{L('Request title', 'عنوان الطلب')}</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} data-testid="req-title" /></label>
            <label><span className="label">{L('Delivery city', 'مدينة التسليم')}</span><select className="input" value={city} onChange={(e) => setCity(e.target.value)} data-testid="req-city">{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label><span className="label">{L('Needed by', 'مطلوب بتاريخ')}</span><input className="input" type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)} /></label>
            <label><span className="label">{L('Project (optional)', 'المشروع (اختياري)')}</span><input className="input" value={project} onChange={(e) => setProject(e.target.value)} /></label>
            <label><span className="label">{L('Cost centre (optional)', 'مركز التكلفة (اختياري)')}</span><input className="input" value={cc} onChange={(e) => setCc(e.target.value)} /></label>
          </section>
          <div className="flex justify-end"><button className="btn-pri" data-testid="submit-request">{L('Submit to procurement', 'إرسال إلى المشتريات')}</button></div>
        </form>
      )}
    </div>
  );
}
