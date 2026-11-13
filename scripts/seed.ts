import './load-env';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { withSystem, schema, pool } from '../src/db';
import { PLANS } from '../config/plans';
import { startSignup, markInvoicePaid } from '../src/lib/billing';
import { seedOps } from './seed-ops';

const DEMO_PASSWORD = 'Demo@12345';

async function main() {
  await withSystem(async (tx) => {
    // 1. plans (upsert from config/plans.ts)
    for (const [i, p] of PLANS.entries()) {
      const row = { id: p.id, audience: p.audience, nameEn: p.name.en, nameAr: p.name.ar, monthlyHalalas: p.monthlySar * 100, yearlyHalalas: p.yearlySar * 100, maxUsers: p.maxUsers, sort: i, active: true };
      await tx.insert(schema.plans).values(row).onConflictDoUpdate({ target: schema.plans.id, set: row });
    }

    // 2. platform super admin
    const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@tawreed.local').toLowerCase();
    const [existing] = await tx.select().from(schema.users).where(eq(schema.users.email, adminEmail));
    if (!existing) {
      await tx.insert(schema.users).values({ email: adminEmail, name: 'Platform Admin', role: 'platform_admin', isPlatformAdmin: true, passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345', 10) });
    }

    // 3. demo companies (skipped if they exist; set SEED_DEMO=false in production)
    if (process.env.SEED_DEMO === 'false') return;
    const demos = [
      {
        planId: 'buyer-business', type: 'buyer' as const, name: 'Al-Noor Construction Co.', cr: '1010456789', vat: '310245678900003', city: 'Riyadh',
        admin: { name: 'Sara Al-Qahtani', email: 'admin@alnoor.demo' },
        users: [
          ['Khalid Al-Otaibi', 'procurement@alnoor.demo', 'procurement'], ['Faisal Al-Dosari', 'quality@alnoor.demo', 'quality'],
          ['Noura Al-Harbi', 'finance@alnoor.demo', 'finance'], ['Omar Al-Shehri', 'logistics@alnoor.demo', 'logistics'], ['Huda Al-Zahrani', 'buyer@alnoor.demo', 'buyer']
        ]
      },
      {
        planId: 'supplier-business', type: 'supplier' as const, name: 'Gulf Industrial Supplies', cr: '2050123456', vat: '300987654300003', city: 'Dammam',
        admin: { name: 'Ahmed Al-Ghamdi', email: 'admin@gulfindustrial.demo' },
        users: [['Yousef Al-Malki', 'sales@gulfindustrial.demo', 'sales'], ['Reem Al-Subaie', 'ops@gulfindustrial.demo', 'operations']]
      }
    ];
    for (const d of demos) {
      const [co] = await tx.select().from(schema.companies).where(eq(schema.companies.crNumber, d.cr));
      if (co) continue;
      const r = await startSignup(tx, {
        planId: d.planId, cycle: 'yearly',
        company: { type: d.type, name: d.name, crNumber: d.cr, vatNumber: d.vat, city: d.city },
        admin: { ...d.admin, password: DEMO_PASSWORD }
      });
      await markInvoicePaid(tx, r.invoice.id, { provider: 'bypass', providerPaymentId: null, amountHalalas: r.invoice.totalHalalas });
      for (const [name, email, role] of d.users) {
        await tx.insert(schema.users).values({ companyId: r.company.id, name, email, role, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) });
      }
    }
  });
  await withSystem((tx) => seedOps(tx, process.env.SEED_DEMO !== 'false'));
  await pool.end();
  console.log(process.env.SEED_DEMO === 'false' ? 'Seed complete (production: plans, price index and platform admin only, no demo companies).' : 'Seed complete. Demo password for *.demo users: ' + DEMO_PASSWORD);
}
main().catch((e) => { console.error(e); process.exit(1); });
