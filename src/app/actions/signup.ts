'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { withSystem } from '@/db';
import { startSignup, SignupError } from '@/lib/billing';
import { createSession, PASSWORD_RULE } from '@/lib/auth';
import { DICT, getLang } from '@/lib/i18n';
import { isUniqueViolation } from '@/lib/db-errors';

export interface SignupState { error?: string; fields?: Record<string, string> }

export async function signupAction(_prev: SignupState, fd: FormData): Promise<SignupState> {
  const t = DICT[await getLang()];
  const fields = Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'password').map(([k, v]) => [k, String(v)]));
  const schema = z.object({
    planId: z.string().min(1), cycle: z.enum(['monthly', 'yearly']), type: z.enum(['buyer', 'supplier']),
    name: z.string().trim().min(2).max(160),
    cr: z.string().trim().regex(/^\d{10}$/, t.signup.errCrFormat),
    vat: z.string().trim().regex(/^3\d{13}3$/, t.signup.errVatFormat),
    city: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional(),
    adminName: z.string().trim().min(2).max(120), email: z.string().trim().email(),
    password: z.string().regex(PASSWORD_RULE, t.auth.rule)
  });
  const parsed = schema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input', fields };
  const v = parsed.data;
  let invoiceId: string;
  try {
    const r = await withSystem((tx) => startSignup(tx, {
      planId: v.planId, cycle: v.cycle,
      company: { type: v.type, name: v.name, crNumber: v.cr, vatNumber: v.vat, city: v.city, phone: v.phone },
      admin: { name: v.adminName, email: v.email, password: v.password }
    }));
    invoiceId = r.invoice.id;
    await createSession(r.admin.id);
  } catch (e) {
    if (e instanceof SignupError) {
      const msg = e.code === 'email_taken' ? t.signup.errEmail : e.code === 'cr_taken' ? t.signup.errCr : t.signup.errPlan;
      return { error: msg, fields };
    }
    if (isUniqueViolation(e)) return { error: t.signup.errEmail, fields };
    throw e;
  }
  redirect(`/checkout/${invoiceId}`);
}
