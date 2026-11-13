import 'server-only';
import { z } from 'zod';
import { aiStatus } from '@/lib/ai';
import { aiCompleteLogged } from '@/lib/ai/log';
import { parseJsonLoose } from '@/lib/ai';
import { CATEGORIES, UNITS, detectCategory } from './catalog';

export interface IndexRow { key: string; category: string; city: string; keywords: string[]; valueHalalas: number; itemEn: string; unitEn: string }
export interface DraftLine { item: string; spec: string; qty: number; unit: string; category: string; indexKey: string | null; estUnitHalalas: number }

/** Finds the price-index product for an item description: every keyword group must match; more groups = more specific. */
export function matchIndex(text: string, rows: IndexRow[], city?: string): IndexRow | null {
  const s = ` ${text.toLowerCase()} `;
  let best: { row: IndexRow; score: number } | null = null;
  for (const r of rows) {
    if (!r.keywords.length) continue;
    const ok = r.keywords.every((group) => group.split('|').some((w) => {
      const word = w.trim().toLowerCase();
      return /^\d+$/.test(word) ? new RegExp(`(^|[^\\d])${word}\\s*(mm|inch|in|"|mm²|mm2)?([^\\d]|$)`).test(s) : s.includes(word);
    }));
    if (!ok) continue;
    const score = r.keywords.length * 10 + (city && r.city.toLowerCase() === city.toLowerCase() ? 1 : 0);
    if (!best || score > best.score) best = { row: r, score };
  }
  return best?.row ?? null;
}

const UNIT_WORDS: [RegExp, string][] = [
  [/^(bags?|اكياس|كيس)$/i, 'bag'], [/^(tons?|tonnes?|t|طن|أطنان)$/i, 'ton'], [/^(pcs|pieces?|units?|nos|no|قطعة|قطع)$/i, 'pcs'],
  [/^(pairs?|زوج)$/i, 'pair'], [/^(sheets?|لوح|ألواح)$/i, 'sheet'], [/^(rolls?|لفة|لفات)$/i, 'roll'], [/^(m|meters?|metres?|متر)$/i, 'm'],
  [/^(kg|kgs|كجم)$/i, 'kg'], [/^(boxes|box|صندوق)$/i, 'box'], [/^(sets?|طقم)$/i, 'set'], [/^(litres?|liters?|لتر)$/i, 'litre']
];
const unitOf = (w: string) => UNIT_WORDS.find(([re]) => re.test(w))?.[1] ?? null;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Deterministic parser used when no AI key is configured (and as a fallback if the AI answer is unusable). */
export function parseRules(text: string, index: IndexRow[], city?: string): { lines: DraftLine[]; notes: string[] } {
  const notes: string[] = [];
  const segs = text
    .replace(/\s+(and|plus|&|و)\s+(?=\d)/gi, ', ')
    .split(/[,;\n،]+|\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines: DraftLine[] = [];
  for (const seg of segs) {
    const m = seg.match(/(\d+(?:[.,]\d+)?)\s*([A-Za-z؀-ۿ]+)?\s*(?:of\s+|من\s+)?(.*)$/);
    if (!m) { if (seg.length > 6) notes.push(seg); continue; }
    const qty = Number(m[1].replace(',', '.'));
    let unit = m[2] ? unitOf(m[2]) : null;
    let rest = (unit ? m[3] : `${m[2] ?? ''} ${m[3] ?? ''}`).trim();
    if (/^(mm|inch|in)\b/i.test(rest) || /^mm\b/i.test(m[2] ?? '')) { notes.push(seg); continue; }
    if (/^(weeks?|days?|months?|hours?|أسبوع|أيام|يوم|شهر)/i.test(rest) || !rest || rest.length < 3) { notes.push(seg); continue; }
    rest = rest.replace(/^(of|من)\s+/i, '').split(/\s+(for|to|at|in|لـ|في)\s+the\s+|\s+for\s+/i)[0].trim();
    const specParts: string[] = [];
    rest = rest.replace(/\b(grade\s*\d+|type\s*[ivx]+\b|class\s*\d|en\s*(iso\s*)?\d{3,5}|astm\s*[a-z]?\d+)\b/gi, (x) => { specParts.push(x.replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase())); return ''; });
    rest = rest.replace(/\bwith\s+(our\s+)?(company\s+)?logo\b/gi, () => { specParts.push('With company logo'); return ''; });
    rest = rest.replace(/\s{2,}/g, ' ').replace(/[\s,-]+$/, '').trim();
    if (rest.length < 3) { notes.push(seg); continue; }
    const category = detectCategory(rest);
    unit = unit ?? CATEGORIES.find((c) => c.id === category)?.unit ?? 'pcs';
    const hit = matchIndex(`${rest} ${specParts.join(' ')}`, index, city);
    lines.push({ item: cap(rest), spec: specParts.join(', '), qty, unit, category: hit?.category ?? category, indexKey: hit?.key ?? null, estUnitHalalas: hit?.valueHalalas ?? 0 });
  }
  return { lines, notes };
}

const AiLines = z.object({
  lines: z.array(z.object({
    item: z.string().min(2).max(160), spec: z.string().max(200).optional().default(''),
    qty: z.coerce.number().positive(), unit: z.string().min(1).max(20), category: z.string().optional().default('other')
  })).min(1).max(60),
  notes: z.array(z.string()).optional().default([])
});

export interface StructureResult { lines: DraftLine[]; notes: string[]; by: string }

/** Turns a free-text need into line items. Uses the configured AI model; falls back to the rules parser. */
export async function structureRequirement(text: string, index: IndexRow[], city: string, ctx: { companyId: string; userId: string }): Promise<StructureResult> {
  const st = aiStatus();
  const useAi = st.configured && st.order[0] !== 'mock';
  if (useAi) {
    try {
      const r = await aiCompleteLogged({
        feature: 'request_structuring', json: true, maxTokens: 1500, temperature: 0,
        system: 'You convert procurement requests from Saudi companies (English or Arabic) into structured line items. Answer with JSON only.',
        prompt: `Extract every item the buyer needs from the text below.
Return {"lines":[{"item":"short product name in the text's language","spec":"standards, grade, size, colour, branding (or empty)","qty":number,"unit":"one of ${UNITS.map((u) => u.id).join(', ')}","category":"one of ${CATEGORIES.map((c) => c.id).join(', ')}"}],"notes":["delivery, certificate or other non-item requirements"]}.
Do not invent items or quantities. Text:\n"""${text.slice(0, 6000)}"""`
      }, { companyId: ctx.companyId, userId: ctx.userId });
      const parsed = AiLines.parse(parseJsonLoose(r.text));
      const lines = parsed.lines.map((l) => {
        const unit = UNITS.some((u) => u.id === l.unit) ? l.unit : (unitOf(l.unit) ?? 'pcs');
        const category = CATEGORIES.some((c) => c.id === l.category) ? l.category : detectCategory(`${l.item} ${l.spec}`);
        const hit = matchIndex(`${l.item} ${l.spec}`, index, city);
        return { item: l.item, spec: l.spec ?? '', qty: l.qty, unit, category: hit?.category ?? category, indexKey: hit?.key ?? null, estUnitHalalas: hit?.valueHalalas ?? 0 };
      });
      return { lines, notes: parsed.notes ?? [], by: r.provider };
    } catch { /* fall through to rules */ }
  }
  const r = parseRules(text, index, city);
  return { ...r, by: 'rules' };
}

/** Optional AI explanation; returns null when no real AI provider is configured or the call fails. */
export async function aiExplain(feature: string, prompt: string, ctx: { companyId?: string | null; userId?: string | null }, lang: 'en' | 'ar'): Promise<{ text: string; provider: string } | null> {
  const st = aiStatus();
  if (!st.configured) return null;
  try {
    const r = await aiCompleteLogged({
      feature, maxTokens: 500, temperature: 0.2,
      system: `You are the procurement assistant inside Tawreed, a Saudi B2B procurement platform. Be factual, brief (max 90 words) and use only the data given. Answer in ${lang === 'ar' ? 'Arabic' : 'English'}.`,
      prompt
    }, ctx);
    return { text: r.text.trim(), provider: r.provider };
  } catch { return null; }
}
