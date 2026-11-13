import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { withSystem, schema } from '@/db';
import { PLANS } from '@config/plans';

export interface PlanView {
  id: string; audience: 'buyer' | 'supplier'; name: { en: string; ar: string }; tagline: { en: string; ar: string };
  monthlyHalalas: number; yearlyHalalas: number; maxUsers: number; highlight: boolean; features: { en: string[]; ar: string[] };
}

export async function listPlans(): Promise<PlanView[]> {
  const rows = await withSystem((tx) => tx.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.sort)));
  return rows.map((r) => {
    const c = PLANS.find((p) => p.id === r.id);
    return {
      id: r.id, audience: r.audience as 'buyer' | 'supplier', name: { en: r.nameEn, ar: r.nameAr },
      tagline: c?.tagline ?? { en: '', ar: '' }, monthlyHalalas: r.monthlyHalalas, yearlyHalalas: r.yearlyHalalas,
      maxUsers: r.maxUsers, highlight: !!c?.highlight, features: c?.features ?? { en: [], ar: [] }
    };
  });
}
