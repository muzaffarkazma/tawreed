import { describe, it, expect } from 'vitest';
import { parseRules, type IndexRow } from '@/lib/ops/structure';
import { zatcaQr, decodeQr } from '@/lib/ops/zatca';
import { scoreQuotes, matchSuppliers } from '@/lib/ops/matching';
import { carrierQuotes } from '@/lib/ops/catalog';
import { ORDER_FLOW, flowStep } from '@/lib/ops/flow';

const IDX: IndexRow[] = [
  { key: 'cement_opc_riyadh', category: 'cement', city: 'Riyadh', keywords: ['cement|أسمنت'], valueHalalas: 1760, itemEn: 'OPC cement 50 kg', unitEn: 'bag' },
  { key: 'cement_opc_dammam', category: 'cement', city: 'Dammam', keywords: ['cement|أسمنت'], valueHalalas: 1710, itemEn: 'OPC cement 50 kg', unitEn: 'bag' },
  { key: 'rebar16_riyadh', category: 'rebar', city: 'Riyadh', keywords: ['rebar|حديد|steel bar', '16'], valueHalalas: 283000, itemEn: 'Rebar 16 mm', unitEn: 'ton' },
  { key: 'rebar12_riyadh', category: 'rebar', city: 'Riyadh', keywords: ['rebar|حديد|steel bar', '12'], valueHalalas: 288000, itemEn: 'Rebar 12 mm', unitEn: 'ton' },
  { key: 'helmet_en397', category: 'ppe', city: 'Riyadh', keywords: ['helmet|خوذ'], valueHalalas: 3450, itemEn: 'Safety helmet', unitEn: 'pcs' }
];

describe('requirement parser (no AI provider)', () => {
  it('turns plain English into priced lines matched to the right index row', () => {
    const r = parseRules('400 bags of cement, 12 tons of 16 mm rebar Grade 60 and 120 helmets EN 397', IDX, 'Riyadh');
    expect(r.lines.map((l) => [l.qty, l.unit, l.category, l.indexKey])).toEqual([
      [400, 'bag', 'cement', 'cement_opc_riyadh'], [12, 'ton', 'rebar', 'rebar16_riyadh'], [120, 'pcs', 'ppe', 'helmet_en397']
    ]);
    expect(r.lines[1].estUnitHalalas).toBe(283000);
  });
  it('prefers the delivery city when the same item is indexed in several cities', () => {
    expect(parseRules('500 bags cement', IDX, 'Dammam').lines[0].indexKey).toBe('cement_opc_dammam');
  });
  it('parses Arabic', () => {
    const r = parseRules('200 كيس أسمنت و 50 خوذة', IDX, 'Riyadh');
    expect(r.lines.map((l) => l.category)).toEqual(['cement', 'ppe']);
  });
});

describe('ZATCA QR', () => {
  it('encodes the 5 Phase-1 TLV tags and decodes back', () => {
    const qr = zatcaQr('Gulf Industrial Supplies', '300987654300003', new Date('2026-11-13T08:00:00Z'), 115000, 15000);
    const d = decodeQr(qr);
    expect(d).toHaveLength(5);
    expect(d[0]).toBe('Gulf Industrial Supplies');
    expect(d[1]).toBe('300987654300003');
    expect(d[3]).toBe('1150.00');
    expect(d[4]).toBe('150.00');
  });
});

describe('scoring and matching', () => {
  it('can recommend a supplier that is not the cheapest', () => {
    const s = scoreQuotes([
      { id: 'a', supplierName: 'Cheap', supplierCompanyId: 'a', totalHalalas: 100_000, leadDays: 10, rating: 3, localContent: 20, discountPct: 0 },
      { id: 'b', supplierName: 'Fast', supplierCompanyId: 'b', totalHalalas: 102_000, leadDays: 2, rating: 4.8, localContent: 70, discountPct: 0 }
    ]);
    expect(s.cheapest?.id).toBe('a');
    expect(s.best?.id).toBe('b');
  });
  it('drops suppliers that cover none of the categories', () => {
    const p = (id: string, categories: string[]) => ({ companyId: id, name: id, city: 'Riyadh', categories, citiesServed: ['Riyadh'], rating: 4, ratingCount: 1, localContent: 50, verified: true });
    const m = matchSuppliers(['cement', 'rebar'], 'Riyadh', [p('both', ['cement', 'rebar']), p('one', ['rebar']), p('none', ['ppe'])]);
    expect(m.map((x) => x.profile.companyId)).toEqual(['both', 'one']);
  });
  it('recommends exactly one carrier', () => {
    expect(carrierQuotes('Dammam', 'Riyadh').filter((c) => c.recommended)).toHaveLength(1);
  });
});

describe('order flow', () => {
  it('every step except closed belongs to one side with a permission', () => {
    for (const s of ORDER_FLOW.slice(0, -1)) { expect(s.side).not.toBeNull(); expect(s.perm).not.toBe(''); }
    expect(flowStep('invoiced').perm).toBe('order.pay');
  });
});
