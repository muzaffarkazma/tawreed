/**
 * Release 2+3 seed. Idempotent: safe on a fresh database and on a Release 1 database.
 *  - company profiles and settings for every existing company
 *  - the starting price index
 *  - (demo) three more suppliers with users, supplier profiles and live market offers
 */
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { schema, type Tx } from '../src/db';
import { startSignup, markInvoicePaid } from '../src/lib/billing';

const DEMO_PASSWORD = 'Demo@12345';

const INDEX: [string, string, string, string, string, string, string, string[], number, number[]][] = [
  // key, category, item en, item ar, unit en, unit ar, city, keyword groups, SAR, history (SAR)
  ['cement_opc_riyadh', 'cement', 'OPC cement 50 kg', 'أسمنت بورتلاندي 50 كجم', 'bag', 'كيس', 'Riyadh', ['cement|أسمنت'], 17.6, [17.9, 17.8, 17.8, 17.7, 17.7, 17.6]],
  ['cement_opc_dammam', 'cement', 'OPC cement 50 kg', 'أسمنت بورتلاندي 50 كجم', 'bag', 'كيس', 'Dammam', ['cement|أسمنت'], 17.1, [17.2, 17.2, 17.1, 17.2, 17.1, 17.1]],
  ['cement_opc_jeddah', 'cement', 'OPC cement 50 kg', 'أسمنت بورتلاندي 50 كجم', 'bag', 'كيس', 'Jeddah', ['cement|أسمنت'], 17.9, [18.1, 18.0, 18.0, 17.9, 17.9, 17.9]],
  ['rebar16_riyadh', 'rebar', 'Rebar 16 mm, Grade 60', 'حديد تسليح 16 مم، درجة 60', 'ton', 'طن', 'Riyadh', ['rebar|حديد|steel bar', '16'], 2830, [2730, 2760, 2790, 2805, 2820, 2830]],
  ['rebar12_riyadh', 'rebar', 'Rebar 12 mm, Grade 60', 'حديد تسليح 12 مم، درجة 60', 'ton', 'طن', 'Riyadh', ['rebar|حديد|steel bar', '12'], 2880, [2790, 2815, 2830, 2845, 2870, 2880]],
  ['rebar16_dammam', 'rebar', 'Rebar 16 mm, Grade 60', 'حديد تسليح 16 مم، درجة 60', 'ton', 'طن', 'Dammam', ['rebar|حديد|steel bar', '16'], 2790, [2700, 2725, 2750, 2765, 2780, 2790]],
  ['mesh_a193', 'rebar', 'Welded wire mesh A193', 'شبك حديد ملحوم A193', 'sheet', 'لوح', 'Riyadh', ['mesh|شبك'], 121, [124, 123, 122, 122, 121, 121]],
  ['helmet_en397', 'ppe', 'Safety helmet EN 397', 'خوذة سلامة EN 397', 'pcs', 'قطعة', 'Riyadh', ['helmet|خوذ'], 34.5, [34.6, 34.5, 34.5, 34.4, 34.5, 34.5]],
  ['vest_class2', 'ppe', 'Hi-vis vest Class 2', 'سترة عاكسة الفئة 2', 'pcs', 'قطعة', 'Riyadh', ['vest|سترة'], 23.8, [24.3, 24.2, 24.1, 24.0, 23.9, 23.8]],
  ['gloves_work', 'ppe', 'Work gloves', 'قفازات عمل', 'pair', 'زوج', 'Riyadh', ['glove|قفاز'], 9.5, [9.8, 9.7, 9.6, 9.6, 9.5, 9.5]],
  ['pipe_gi_2in', 'pipes', 'Galvanized pipe 2 inch, 6 m', 'أنبوب مجلفن 2 بوصة، 6 م', 'pcs', 'قطعة', 'Jubail', ['pipe|أنبوب|أنابيب', '2'], 145, [139, 140, 142, 143, 144, 145]],
  ['cable_4mm', 'electrical', 'Copper cable 4 mm², 100 m', 'كابل نحاس 4 مم²، 100 م', 'roll', 'لفة', 'Riyadh', ['cable|كابل', '4'], 410, [398, 401, 404, 406, 409, 410]]
];

interface DemoSupplier { cr: string; vat: string; name: string; city: string; plan: string; admin: [string, string]; users: [string, string, string][]; categories: string[]; cities: string[]; lc: number; rating: number; count: number; verified: boolean;
  offers: [string, string, string, string, string | null, string, number, number, number, number, number, number][] }

const SUPPLIERS: DemoSupplier[] = [
  { cr: '2050123456', vat: '300987654300003', name: 'Gulf Industrial Supplies', city: 'Dammam', plan: 'supplier-business', admin: ['Ahmed Al-Ghamdi', 'admin@gulfindustrial.demo'],
    users: [['Yousef Al-Malki', 'sales@gulfindustrial.demo', 'sales'], ['Reem Al-Subaie', 'ops@gulfindustrial.demo', 'operations'], ['Tariq Al-Anazi', 'finance@gulfindustrial.demo', 'finance']],
    categories: ['cement', 'rebar', 'ppe'], cities: ['Riyadh', 'Dammam', 'Khobar', 'Jubail'], lc: 72, rating: 4.6, count: 41, verified: true,
    offers: [['Steel rebar 16 mm, Grade 40', 'SASO ASTM A615 · Dammam yard', 'rebar', 'ton', null, 'Dammam', 60, 5, 2650, 2690, 2760, 3], ['OPC cement, 50 kg bag', 'SASO GSO 1914 Type I', 'cement', 'bag', 'cement_opc_dammam', 'Dammam', 2000, 500, 16.5, 16.9, 17.4, 4]] },
  { cr: '1010223344', vat: '310223344500003', name: 'Al-Jazira Building Materials', city: 'Riyadh', plan: 'supplier-business', admin: ['Saad Al-Shammari', 'admin@aljazira.demo'],
    users: [['Mona Al-Rasheed', 'sales@aljazira.demo', 'sales'], ['Bandar Al-Harthy', 'ops@aljazira.demo', 'operations'], ['Lulwa Al-Otaibi', 'finance@aljazira.demo', 'finance']],
    categories: ['cement', 'rebar', 'pipes'], cities: ['Riyadh', 'Buraydah'], lc: 64, rating: 4.3, count: 27, verified: true,
    offers: [['OPC cement, 50 kg bag', 'SASO GSO 1914 Type I · Riyadh warehouse', 'cement', 'bag', 'cement_opc_riyadh', 'Riyadh', 3000, 200, 16.8, 17.2, 17.7, 2], ['Welded wire mesh A193', '2.4 x 4.8 m sheets', 'rebar', 'sheet', 'mesh_a193', 'Riyadh', 900, 50, 116, 119, 123, 3]] },
  { cr: '1010556677', vat: '310556677800003', name: 'Riyadh Steel Trading', city: 'Riyadh', plan: 'supplier-starter', admin: ['Fahd Al-Dossary', 'admin@riyadhsteel.demo'],
    users: [['Nasser Al-Qahtani', 'sales@riyadhsteel.demo', 'sales']],
    categories: ['rebar'], cities: ['Riyadh'], lc: 55, rating: 3.9, count: 18, verified: false,
    offers: [['Steel rebar 12 mm, Grade 60', 'SASO ASTM A615 · last lot', 'rebar', 'ton', 'rebar12_riyadh', 'Riyadh', 3, 1, 2830, 2860, 2920, 2]] },
  { cr: '1010778899', vat: '310778899100003', name: 'Safety First Trading', city: 'Riyadh', plan: 'supplier-starter', admin: ['Huda Al-Mutairi', 'admin@safetyfirst.demo'],
    users: [['Omar Al-Zahrani', 'sales@safetyfirst.demo', 'sales']],
    categories: ['ppe'], cities: ['Riyadh', 'Jeddah', 'Dammam'], lc: 35, rating: 4.5, count: 33, verified: true,
    offers: [['Safety helmet, white', 'EN 397 with chin strap', 'ppe', 'pcs', 'helmet_en397', 'Riyadh', 800, 50, 32.6, 33.4, 34.6, 1], ['High-visibility vest', 'EN ISO 20471 Class 2', 'ppe', 'pcs', 'vest_class2', 'Riyadh', 1500, 100, 21.6, 22.3, 23.2, 2], ['Work gloves, nitrile coated', 'EN 388', 'ppe', 'pair', 'gloves_work', 'Riyadh', 2000, 100, 8.9, 9.2, 9.6, 1]] }
];

export async function seedOps(tx: Tx, demo: boolean) {
  // price index
  for (const [key, category, itemEn, itemAr, unitEn, unitAr, city, keywords, sar, hist] of INDEX) {
    await tx.insert(schema.priceIndex).values({ key, category, itemEn, itemAr, unitEn, unitAr, city, keywords, valueHalalas: Math.round(sar * 100), history: hist.map((h) => Math.round(h * 100)), sourceCount: 40 + hist.length * 7, changePct: Math.round(((sar - hist[0]) / hist[0]) * 1000) / 10 })
      .onConflictDoNothing();
  }

  if (demo) {
    for (const s of SUPPLIERS) {
      let [co] = await tx.select().from(schema.companies).where(eq(schema.companies.crNumber, s.cr));
      if (!co) {
        const r = await startSignup(tx, { planId: s.plan, cycle: 'yearly', company: { type: 'supplier', name: s.name, crNumber: s.cr, vatNumber: s.vat, city: s.city }, admin: { name: s.admin[0], email: s.admin[1], password: DEMO_PASSWORD } });
        await markInvoicePaid(tx, r.invoice.id, { provider: 'bypass', providerPaymentId: null, amountHalalas: r.invoice.totalHalalas });
        co = r.company;
      }
      for (const [name, email, role] of s.users) {
        const [u] = await tx.select().from(schema.users).where(eq(schema.users.email, email));
        if (!u) await tx.insert(schema.users).values({ companyId: co.id, name, email, role, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) });
      }
      await tx.insert(schema.companyProfiles).values({ companyId: co.id, type: 'supplier', name: co.name, city: co.city }).onConflictDoNothing();
      await tx.update(schema.companyProfiles).set({ categories: s.categories, citiesServed: s.cities, localContent: s.lc, rating: s.rating, ratingCount: s.count, verified: s.verified })
        .where(eq(schema.companyProfiles.companyId, co.id));
      const [has] = await tx.select({ id: schema.offers.id }).from(schema.offers).where(eq(schema.offers.supplierCompanyId, co.id)).limit(1);
      if (!has) {
        for (const [item, spec, category, unit, indexKey, city, qty, min, adv, nd, r30, lead] of s.offers) {
          const n = await tx.execute(sql`select nextval('offer_seq') as n`);
          const num = `OF-${new Date().getFullYear()}-${String((n.rows[0] as { n: string }).n).padStart(5, '0')}`;
          await tx.insert(schema.offers).values({ number: num, supplierCompanyId: co.id, supplierName: co.name, item, spec, category, indexKey, unit, city, qtyAvailable: qty, minQty: min,
            priceAdvHalalas: Math.round(adv * 100), priceNdHalalas: Math.round(nd * 100), price30Halalas: Math.round(r30 * 100), leadDays: lead, validUntil: new Date(Date.now() + 30 * 86400_000) });
        }
      }
    }
    // demo buyer gets realistic limits
    const [alnoor] = await tx.select().from(schema.companies).where(eq(schema.companies.crNumber, '1010456789'));
    if (alnoor) await tx.insert(schema.companySettings).values({ companyId: alnoor.id, approvalThresholdHalalas: 5_000_000, autoPayLimitHalalas: 2_000_000, monthlyLimitHalalas: 50_000_000 }).onConflictDoNothing();
  }

  // every company has a directory profile and settings
  const all = await tx.select().from(schema.companies);
  for (const c of all) {
    await tx.insert(schema.companyProfiles).values({ companyId: c.id, type: c.type, name: c.name, city: c.city, active: c.status === 'active' }).onConflictDoNothing();
    await tx.insert(schema.companySettings).values({ companyId: c.id }).onConflictDoNothing();
  }
}
