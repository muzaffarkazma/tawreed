'use server';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { withSystem, schema } from '@/db';
import { verifyLogin, createSession, destroySession, getCurrentUser, PASSWORD_RULE, pendingInvoiceFor } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { DICT, getLang } from '@/lib/i18n';

export interface FormState { error?: string; ok?: string; email?: string }

export async function loginAction(_p: FormState, fd: FormData): Promise<FormState> {
  const t = DICT[await getLang()];
  const email = String(fd.get('email') ?? '');
  const r = await verifyLogin(email, String(fd.get('password') ?? ''));
  if (!r.ok) return { error: r.reason === 'throttled' ? t.auth.throttled : r.reason === 'inactive' ? t.auth.inactive : t.auth.invalid, email };
  await createSession(r.userId);
  if (r.platform) redirect('/platform');
  if (r.companyStatus === 'pending_payment') {
    const me = await getCurrentUser();
    const inv = me?.company ? await pendingInvoiceFor(me.company.id) : null;
    redirect(inv ? `/checkout/${inv}` : '/pricing');
  }
  redirect('/app');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function changePasswordAction(_p: FormState, fd: FormData): Promise<FormState> {
  const t = DICT[await getLang()];
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const current = String(fd.get('current') ?? '');
  const next = String(fd.get('next') ?? '');
  if (next !== String(fd.get('confirm') ?? '')) return { error: t.auth.mismatch };
  if (!PASSWORD_RULE.test(next)) return { error: t.auth.rule };
  const ok = await withSystem(async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, me.id));
    if (!u || !(await bcrypt.compare(current, u.passwordHash))) return false;
    await tx.update(schema.users).set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false }).where(eq(schema.users.id, me.id));
    await audit(tx, { companyId: u.companyId, userId: u.id, action: 'user.password_changed' });
    return true;
  });
  if (!ok) return { error: t.auth.wrongCurrent };
  redirect(me.isPlatformAdmin ? '/platform' : '/app');
}
