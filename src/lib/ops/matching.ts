import type { Lang } from './catalog';
import { cityName, categoryName } from './catalog';

export interface Profile { companyId: string; name: string; city: string; categories: string[]; citiesServed: string[]; rating: number; ratingCount: number; localContent: number; verified: boolean }
export interface SupplierMatch { profile: Profile; score: number; coverage: number; reasonEn: string; reasonAr: string }

/** Ranks suppliers for an RFQ: category coverage 55, serves the delivery city 15, rating 15, local content 10, verified 5. */
export function matchSuppliers(lineCategories: string[], deliveryCity: string, suppliers: Profile[]): SupplierMatch[] {
  const cats = [...new Set(lineCategories)];
  const real = cats.filter((c) => c !== 'other');
  const out: SupplierMatch[] = [];
  for (const p of suppliers) {
    const covered = real.length ? real.filter((c) => p.categories.includes(c)).length : 1;
    const coverage = real.length ? covered / real.length : 0.5;
    if (real.length && covered === 0) continue;
    const serves = p.city.toLowerCase() === deliveryCity.toLowerCase() || p.citiesServed.some((c) => c.toLowerCase() === deliveryCity.toLowerCase());
    const score = Math.round(coverage * 55 + (serves ? 15 : 0) + (p.rating / 5) * 15 + (p.localContent / 100) * 10 + (p.verified ? 5 : 0));
    const catEn = real.length ? `covers ${covered} of ${real.length} categories` : 'general supplier';
    const catAr = real.length ? `يغطي ${covered} من ${real.length} فئات` : 'مورد عام';
    out.push({
      profile: p, score, coverage,
      reasonEn: `${catEn} · ${serves ? `serves ${deliveryCity}` : `based in ${p.city}`} · ★${p.rating.toFixed(1)} · local content ${p.localContent}%${p.verified ? ' · verified' : ''}`,
      reasonAr: `${catAr} · ${serves ? `يخدم ${cityName(deliveryCity, 'ar')}` : `مقره ${cityName(p.city, 'ar')}`} · ★${p.rating.toFixed(1)} · محتوى محلي ${p.localContent}%${p.verified ? ' · موثّق' : ''}`
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface QuoteRow { id: string; supplierName: string; supplierCompanyId: string; totalHalalas: number; leadDays: number; rating: number; localContent: number; discountPct: number }
export interface Scored extends QuoteRow { score: number }

/** Best-overall scoring: price 40, lead time 25, rating 20, local content 15. */
export function scoreQuotes(q: QuoteRow[]): { rows: Scored[]; best: Scored | null; cheapest: Scored | null } {
  if (!q.length) return { rows: [], best: null, cheapest: null };
  const minP = Math.min(...q.map((x) => x.totalHalalas)), minL = Math.min(...q.map((x) => x.leadDays));
  const rows = q.map((x) => ({ ...x, score: Math.round(40 * (minP / x.totalHalalas) + 25 * (minL / Math.max(1, x.leadDays)) + 20 * (x.rating / 5) + 15 * (x.localContent / 100)) }))
    .sort((a, b) => b.score - a.score);
  const cheapest = rows.reduce((a, b) => (b.totalHalalas < a.totalHalalas ? b : a));
  return { rows, best: rows[0], cheapest };
}

export function recommendationText(best: Scored, cheapest: Scored, budgetHalalas: number, lang: Lang): string {
  const pct = (a: number, b: number) => ((a - b) / b) * 100;
  const vsBudget = budgetHalalas ? pct(best.totalHalalas, budgetHalalas) : null;
  const budgetTxt = vsBudget === null ? '' : lang === 'ar'
    ? ` وهو ${vsBudget <= 0 ? 'أقل' : 'أعلى'} من الميزانية التقديرية بنسبة ${Math.abs(vsBudget).toFixed(1)}%.`
    : ` It is ${Math.abs(vsBudget).toFixed(1)}% ${vsBudget <= 0 ? 'under' : 'over'} the estimated budget.`;
  if (best.id === cheapest.id) {
    return lang === 'ar'
      ? `${best.supplierName} هو الأرخص والأفضل إجمالاً (الدرجة ${best.score}).${budgetTxt}`
      : `${best.supplierName} is both the cheapest and the best overall (score ${best.score}).${budgetTxt}`;
  }
  const gap = pct(best.totalHalalas, cheapest.totalHalalas).toFixed(1);
  const days = cheapest.leadDays - best.leadDays;
  return lang === 'ar'
    ? `يُوصى بالترسية على ${best.supplierName}: سعره أعلى من الأرخص (${cheapest.supplierName}) بنسبة ${gap}%، لكن ${days > 0 ? `يورّد أسرع بـ${days} أيام، و` : ''}تقييمه ★${best.rating.toFixed(1)} مقابل ★${cheapest.rating.toFixed(1)} ومحتواه المحلي ${best.localContent}% مقابل ${cheapest.localContent}%.${budgetTxt}`
    : `Award to ${best.supplierName}. It is ${gap}% above the cheapest bid (${cheapest.supplierName}) but ${days > 0 ? `delivers ${days} days sooner, ` : ''}is rated ★${best.rating.toFixed(1)} vs ★${cheapest.rating.toFixed(1)} and has ${best.localContent}% local content vs ${cheapest.localContent}%.${budgetTxt}`;
}

export const pctVs = (value: number, base: number) => (base ? ((value - base) / base) * 100 : null);
export { categoryName };
