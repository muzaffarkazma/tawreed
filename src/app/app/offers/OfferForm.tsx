'use client';
import { useState } from 'react';

type Opt = { id: string; name: string };
type Ix = { key: string; label: string; item: string; category: string; unit: string; city: string; value: number };

/** Offer form with price suggestions from the Tawreed index (advance −4%, on delivery −2%, 30 days +1%). */
export function OfferForm({ lang, defaultCity, index, cities, units, categories }: { lang: 'en' | 'ar'; defaultCity: string; index: Ix[]; cities: Opt[]; units: Opt[]; categories: Opt[] }) {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [f, setF] = useState({ indexKey: '', item: '', spec: '', category: 'other', unit: 'pcs', city: defaultCity, qty: '', min: '', adv: '', nd: '', r30: '', lead: '2', valid: '14' });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const pick = (key: string) => {
    const i = index.find((x) => x.key === key);
    if (!i) return set('indexKey', '');
    const p = (m: number) => ((i.value * m) / 100).toFixed(2);
    setF((x) => ({ ...x, indexKey: key, item: x.item || i.item, category: i.category, unit: i.unit, city: i.city, adv: p(0.96), nd: p(0.98), r30: p(1.01) }));
  };
  const ix = index.find((x) => x.key === f.indexKey);
  return (
    <div className="space-y-4">
      <div className="ai">
        <div className="ai-h"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /></svg>{L('Price from the index', 'التسعير من المؤشر')}</div>
        <select className="input" value={f.indexKey} onChange={(e) => pick(e.target.value)} name="indexKey" data-testid="offer-index">
          <option value="">{L('Not linked to the index', 'غير مرتبط بالمؤشر')}</option>
          {index.map((i) => <option key={i.key} value={i.key}>{i.label} · {(i.value / 100).toFixed(2)}</option>)}
        </select>
        {ix && <div className="mt-1.5 text-xs">{L('Suggested: advance −4%, on delivery −2%, 30 days +1% against the index. Buyers see your price vs the index.', 'المقترح: مقدم −4%، عند التسليم −2%، 30 يوماً +1% مقابل المؤشر. يرى المشترون سعرك مقارنة بالمؤشر.')}</div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">{L('Product', 'المنتج')}</span><input className="input" name="item" value={f.item} onChange={(e) => set('item', e.target.value)} required minLength={3} data-testid="offer-item" /></label>
        <label><span className="label">{L('Specification', 'المواصفات')}</span><input className="input" name="spec" value={f.spec} onChange={(e) => set('spec', e.target.value)} /></label>
        <label><span className="label">{L('Category', 'الفئة')}</span><select className="input" name="category" value={f.category} onChange={(e) => set('category', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">{L('Ships from', 'الشحن من')}</span><select className="input" name="city" value={f.city} onChange={(e) => set('city', e.target.value)}>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label><span className="label">{L('Unit', 'الوحدة')}</span><select className="input" name="unit" value={f.unit} onChange={(e) => set('unit', e.target.value)}>{units.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">{L('Quantity available', 'الكمية المتاحة')}</span><input className="input" name="qty" type="number" step="any" min="0.001" value={f.qty} onChange={(e) => set('qty', e.target.value)} required data-testid="offer-qty" /></label>
        <label><span className="label">{L('Minimum order', 'الحد الأدنى')}</span><input className="input" name="min" type="number" step="any" min="0.001" value={f.min} onChange={(e) => set('min', e.target.value)} required data-testid="offer-min" /></label>
        <label><span className="label">{L('Lead time (days)', 'مدة التوريد (أيام)')}</span><input className="input" name="lead" type="number" min="1" value={f.lead} onChange={(e) => set('lead', e.target.value)} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label><span className="label">{L('Price · advance (SAR)', 'السعر · مقدم')}</span><input className="input" name="adv" inputMode="decimal" value={f.adv} onChange={(e) => set('adv', e.target.value)} required data-testid="offer-adv" /></label>
        <label><span className="label">{L('Price · on delivery', 'السعر · عند التسليم')}</span><input className="input" name="nd" inputMode="decimal" value={f.nd} onChange={(e) => set('nd', e.target.value)} required data-testid="offer-nd" /></label>
        <label><span className="label">{L('Price · 30 days', 'السعر · 30 يوماً')}</span><input className="input" name="r30" inputMode="decimal" value={f.r30} onChange={(e) => set('r30', e.target.value)} required data-testid="offer-r30" /></label>
        <label><span className="label">{L('Offer valid (days)', 'صلاحية العرض (أيام)')}</span><input className="input" name="valid" type="number" min="1" max="90" value={f.valid} onChange={(e) => set('valid', e.target.value)} /></label>
      </div>
      <div className="flex justify-end"><button className="btn-pri" data-testid="post-offer">{L('Publish to market', 'انشر في السوق')}</button></div>
    </div>
  );
}
