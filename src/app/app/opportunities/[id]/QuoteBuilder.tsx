'use client';
import { useState } from 'react';

type Line = { id: string; lineNo: number; item: string; spec: string; qty: number; unit: string; suggest: number; current: number };

/** Supplier quote form: unit prices per line, live total, and one-click fill from the Tawreed index. */
export function QuoteBuilder({ lang, lines, lead, valid, notes }: { lang: 'en' | 'ar'; lines: Line[]; lead: number; valid: number; notes: string }) {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [p, setP] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, l.current ? (l.current / 100).toFixed(2) : ''])));
  const total = lines.reduce((s, l) => s + Math.round(l.qty * Math.round((Number(p[l.id]) || 0) * 100)), 0);
  const fmt = (h: number) => (h / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fill = (pct: number) => setP(Object.fromEntries(lines.map((l) => [l.id, l.suggest ? ((l.suggest * (1 + pct / 100)) / 100).toFixed(2) : p[l.id]])));
  return (
    <div className="space-y-4">
      <div className="ai">
        <div className="ai-h"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /></svg>{L('Price assistant', 'مساعد التسعير')}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">{L('Fill prices from the Tawreed index:', 'املأ الأسعار من مؤشر توريد:')}
          <button type="button" className="chip" onClick={() => fill(-3)} data-testid="fill-competitive">{L('Competitive (−3%)', 'تنافسي (−3%)')}</button>
          <button type="button" className="chip" onClick={() => fill(0)} data-testid="fill-index">{L('At index', 'بسعر المؤشر')}</button>
          <button type="button" className="chip" onClick={() => fill(3)}>{L('Premium (+3%)', 'مرتفع (+3%)')}</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[560px]">
          <thead><tr><th>#</th><th>{L('Item', 'الصنف')}</th><th>{L('Qty', 'الكمية')}</th><th>{L('Index', 'المؤشر')}</th><th>{L('Your unit price (SAR)', 'سعر الوحدة (ر.س)')}</th><th>{L('Line total', 'إجمالي البند')}</th></tr></thead>
          <tbody>{lines.map((l) => (
            <tr key={l.id}>
              <td className="num text-muted">{l.lineNo}</td>
              <td><div className="font-medium">{l.item}</div><div className="text-xs text-muted">{l.spec}</div></td>
              <td className="num">{l.qty} {l.unit}</td>
              <td className="num text-xs text-muted">{l.suggest ? fmt(l.suggest) : '—'}</td>
              <td><input className="input w-28 py-1.5" name={`price_${l.id}`} inputMode="decimal" required value={p[l.id]} onChange={(e) => setP({ ...p, [l.id]: e.target.value })} data-testid={`price-${l.lineNo}`} /></td>
              <td className="num">{fmt(Math.round(l.qty * Math.round((Number(p[l.id]) || 0) * 100)))}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={5} className="px-3 py-2.5 text-end text-sm">{L('Total excl. VAT', 'الإجمالي دون الضريبة')}</td><td className="num px-3 font-semibold" data-testid="quote-total">{fmt(total)}</td></tr>
            <tr><td colSpan={5} className="px-3 pb-2 text-end text-xs text-muted">{L('incl. 15% VAT', 'شامل ضريبة 15%')}</td><td className="num px-3 pb-2 text-xs text-muted">{fmt(total + Math.round(total * 0.15))}</td></tr></tfoot>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">{L('Lead time (days)', 'مدة التوريد (أيام)')}</span><input className="input" name="lead" type="number" min={1} max={365} defaultValue={lead} required data-testid="lead" /></label>
        <label><span className="label">{L('Quote valid for (days)', 'صلاحية العرض (أيام)')}</span><input className="input" name="valid" type="number" min={1} max={180} defaultValue={valid} /></label>
        <label className="sm:col-span-3"><span className="label">{L('Notes for the buyer', 'ملاحظات للمشتري')}</span><input className="input" name="notes" defaultValue={notes} placeholder={L('e.g. Mill certificates included; delivery in 2 trucks', 'مثال: شهادات المصنع مرفقة؛ التسليم بشاحنتين')} /></label>
      </div>
    </div>
  );
}
