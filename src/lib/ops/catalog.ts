/** Shared reference data for sourcing and fulfilment (bilingual). */
export type Lang = 'en' | 'ar';
export type Bi = { en: string; ar: string };
export const bi = (lang: Lang, b: Bi) => b[lang];

export const CATEGORIES: { id: string; name: Bi; unit: string; words: string[] }[] = [
  { id: 'cement', name: { en: 'Cement and concrete', ar: 'الأسمنت والخرسانة' }, unit: 'bag', words: ['cement', 'concrete', 'أسمنت', 'خرسانة'] },
  { id: 'rebar', name: { en: 'Rebar and steel', ar: 'حديد التسليح' }, unit: 'ton', words: ['rebar', 'steel bar', 'mesh', 'حديد', 'شبك'] },
  { id: 'ppe', name: { en: 'PPE and safety', ar: 'معدات السلامة' }, unit: 'pcs', words: ['helmet', 'vest', 'glove', 'boot', 'goggle', 'ppe', 'harness', 'خوذ', 'سترة', 'قفاز', 'حذاء'] },
  { id: 'pipes', name: { en: 'Pipes and fittings', ar: 'الأنابيب والوصلات' }, unit: 'pcs', words: ['pipe', 'fitting', 'elbow', 'أنبوب', 'أنابيب'] },
  { id: 'electrical', name: { en: 'Electrical', ar: 'الكهرباء' }, unit: 'roll', words: ['cable', 'wire', 'breaker', 'socket', 'كابل', 'سلك'] },
  { id: 'mep', name: { en: 'MEP and HVAC', ar: 'الكهروميكانيك والتكييف' }, unit: 'pcs', words: ['duct', 'hvac', 'valve', 'pump', 'filter', 'تكييف', 'مضخة', 'صمام', 'فلتر'] },
  { id: 'other', name: { en: 'Other', ar: 'أخرى' }, unit: 'pcs', words: [] }
];
export const categoryName = (id: string, lang: Lang) => (CATEGORIES.find((c) => c.id === id) ?? CATEGORIES.at(-1)!).name[lang];

export function detectCategory(text: string): string {
  const s = text.toLowerCase();
  for (const c of CATEGORIES) if (c.words.some((w) => s.includes(w))) return c.id;
  return 'other';
}

export const UNITS: { id: string; name: Bi }[] = [
  { id: 'bag', name: { en: 'bag', ar: 'كيس' } }, { id: 'ton', name: { en: 'ton', ar: 'طن' } }, { id: 'pcs', name: { en: 'pcs', ar: 'قطعة' } },
  { id: 'pair', name: { en: 'pair', ar: 'زوج' } }, { id: 'sheet', name: { en: 'sheet', ar: 'لوح' } }, { id: 'roll', name: { en: 'roll', ar: 'لفة' } },
  { id: 'm', name: { en: 'm', ar: 'م' } }, { id: 'kg', name: { en: 'kg', ar: 'كجم' } }, { id: 'box', name: { en: 'box', ar: 'صندوق' } },
  { id: 'set', name: { en: 'set', ar: 'طقم' } }, { id: 'litre', name: { en: 'litre', ar: 'لتر' } }
];
export const unitName = (id: string, lang: Lang) => UNITS.find((u) => u.id === id)?.name[lang] ?? id;

export const TERMS: { id: 'adv' | 'nd' | 'r30'; name: Bi; hint: Bi }[] = [
  { id: 'adv', name: { en: 'Advance', ar: 'مقدماً' }, hint: { en: 'pay now', ar: 'دفع فوري' } },
  { id: 'nd', name: { en: 'Next day', ar: 'اليوم التالي' }, hint: { en: 'pay in 1 day', ar: 'دفع خلال يوم' } },
  { id: 'r30', name: { en: '30 days', ar: '30 يوماً' }, hint: { en: 'credit', ar: 'آجل' } }
];
export type Term = 'adv' | 'nd' | 'r30';
export const termName = (id: string, lang: Lang) => TERMS.find((t) => t.id === id)?.name[lang] ?? id;

export const CITIES: { id: string; name: Bi; lat: number; lon: number }[] = [
  { id: 'Riyadh', name: { en: 'Riyadh', ar: 'الرياض' }, lat: 24.71, lon: 46.68 },
  { id: 'Jeddah', name: { en: 'Jeddah', ar: 'جدة' }, lat: 21.49, lon: 39.19 },
  { id: 'Makkah', name: { en: 'Makkah', ar: 'مكة المكرمة' }, lat: 21.39, lon: 39.86 },
  { id: 'Madinah', name: { en: 'Madinah', ar: 'المدينة المنورة' }, lat: 24.47, lon: 39.61 },
  { id: 'Dammam', name: { en: 'Dammam', ar: 'الدمام' }, lat: 26.43, lon: 50.1 },
  { id: 'Khobar', name: { en: 'Khobar', ar: 'الخبر' }, lat: 26.28, lon: 50.21 },
  { id: 'Jubail', name: { en: 'Jubail', ar: 'الجبيل' }, lat: 27.01, lon: 49.66 },
  { id: 'Buraydah', name: { en: 'Buraydah', ar: 'بريدة' }, lat: 26.33, lon: 43.97 },
  { id: 'Tabuk', name: { en: 'Tabuk', ar: 'تبوك' }, lat: 28.38, lon: 36.57 },
  { id: 'Abha', name: { en: 'Abha', ar: 'أبها' }, lat: 18.22, lon: 42.51 }
];
export const cityName = (id: string, lang: Lang) => CITIES.find((c) => c.id.toLowerCase() === id.toLowerCase())?.name[lang] ?? id;
export const findCity = (id: string) => CITIES.find((c) => c.id.toLowerCase() === id.trim().toLowerCase());

/** Road distance estimate in km (great-circle x 1.25). Same city = 30 km. */
export function roadKm(a: string, b: string) {
  const A = findCity(a), B = findCity(b);
  if (!A || !B) return 400;
  if (A.id === B.id) return 30;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(B.lat - A.lat) / 2) ** 2 + Math.cos(r(A.lat)) * Math.cos(r(B.lat)) * Math.sin(r(B.lon - A.lon) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 1.25);
}

export interface CarrierQuote { id: string; name: Bi; vehicle: Bi; hours: number; costHalalas: number; onTime: number; recommended: boolean; why: Bi }

/** Carrier options for a route; the recommendation balances transit time (60%) and cost (40%). */
export function carrierQuotes(from: string, to: string): CarrierQuote[] {
  const km = roadKm(from, to);
  const base = [
    { id: 'sahara', name: { en: 'Sahara Freight', ar: 'صحارى للشحن' }, vehicle: { en: 'Flatbed 12 m', ar: 'مسطحة 12 م' }, speed: 72, prep: 2, perKm: 320, min: 90000, onTime: 97 },
    { id: 'najm', name: { en: 'Najm Logistics', ar: 'نجم للخدمات اللوجستية' }, vehicle: { en: 'Flatbed 12 m', ar: 'مسطحة 12 م' }, speed: 55, prep: 8, perKm: 260, min: 70000, onTime: 91 },
    { id: 'bahar', name: { en: 'Al-Bahar Trucking', ar: 'البحر للنقل' }, vehicle: { en: '2 x 7 m trucks', ar: 'شاحنتان 7 م' }, speed: 78, prep: 1, perKm: 390, min: 110000, onTime: 94 }
  ].map((c) => ({ ...c, hours: Math.max(1, Math.round(c.prep + km / c.speed)), costHalalas: Math.max(c.min, Math.round((km * c.perKm) / 100) * 100) }));
  const minH = Math.min(...base.map((c) => c.hours)), minC = Math.min(...base.map((c) => c.costHalalas));
  const score = (c: (typeof base)[number]) => 0.6 * (minH / c.hours) + 0.4 * (minC / c.costHalalas) + c.onTime / 1000;
  const best = base.reduce((a, b) => (score(b) > score(a) ? b : a));
  return base.map((c) => ({
    id: c.id, name: c.name, vehicle: c.vehicle, hours: c.hours, costHalalas: c.costHalalas, onTime: c.onTime, recommended: c.id === best.id,
    why: c.id === best.id
      ? { en: `Best balance of transit time and cost on this ${km} km route; ${c.onTime}% on time`, ar: `أفضل توازن بين مدة النقل والتكلفة على مسار ${km} كم؛ التزام ${c.onTime}%` }
      : c.costHalalas === minC ? { en: 'Cheapest, but slower', ar: 'الأرخص لكنه أبطأ' } : { en: 'Faster pickup, higher cost', ar: 'استلام أسرع وتكلفة أعلى' }
  }));
}

export const DISPUTE_TYPES: { id: string; name: Bi }[] = [
  { id: 'short', name: { en: 'Short delivery', ar: 'نقص في التسليم' } },
  { id: 'damaged', name: { en: 'Damaged goods', ar: 'بضاعة تالفة' } },
  { id: 'late', name: { en: 'Late delivery', ar: 'تأخر التسليم' } },
  { id: 'invoice', name: { en: 'Invoice mismatch', ar: 'عدم تطابق الفاتورة' } },
  { id: 'other', name: { en: 'Other', ar: 'أخرى' } }
];
