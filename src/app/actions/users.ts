'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, count, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema, type Tx } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { isValidRole } from '@/lib/roles';
import { audit } from '@/lib/audit';
import { DICT, getLang } from '@/lib/i18n';
import { isUniqueViolation } from '@/lib/db-errors';

export interface UserActionState { error?: string; saved?: boolean; temp?: { email: string; password: string } }

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.company || me.role !== 'company_admin' || me.company.status !== 'active') redirect('/app?denied=1');
  return me as typeof me & { company: NonNullable<typeof me.company> };
}

export async function genTempPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const d = '23456789';
  const pick = (s: string) => s[randomInt(s.length)];
  const chars = [pick(a), pick(a), pick(a), pick(a), pick(a), pick(d), pick(d), pick(d), pick('@#$%'), pick(a)];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

async function activeCount(tx: Tx, companyId: string) {
  const [{ n }] = await tx.select({ n: count() }).from(schema.users).where(and(eq(schema.users.companyId, companyId), eq(schema.users.active, true)));
  return Number(n);
}
async function otherActiveAdmins(tx: Tx, companyId: string, exceptId: string) {
  const [{ n }] = await tx.select({ n: count() }).from(schema.users)
    .where(and(eq(schema.users.companyId, companyId), eq(schema.users.active, true), eq(schema.users.role, 'company_admin'), ne(schema.users.id, exceptId)));
  return Number(n);
}

export async function createUserAction(_p: UserActionState, fd: FormData): Promise<UserActionState> {
  const me = await requireAdmin();
  const t = DICT[await getLang()];
  const parsed = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email(), role: z.string() }).safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const v = parsed.data;
  if (!isValidRole(me.company.type, v.role)) return { error: 'Invalid role' };
  const max = me.company.subscription?.maxUsers ?? 0;
  const password = await genTempPassword();
  try {
    const res = await withTenant(me.company.id, async (tx) => {
      if ((await activeCount(tx, me.company.id)) >= max) return { error: t.users.seatLimit.replace('{max}', String(max)) };
      const [u] = await tx.insert(schema.users).values({
        companyId: me.company.id, name: v.name, email: v.email, role: v.role, mustChangePassword: true, passwordHash: await bcrypt.hash(password, 10)
      }).returning();
      await audit(tx, { companyId: me.company.id, userId: me.id, action: 'user.created', entity: 'user', entityId: u.id, data: { email: v.email, role: v.role } });
      return null;
    });
    if (res) return res;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: t.users.errEmail };
    throw e;
  }
  revalidatePath('/app/admin/users');
  return { temp: { email: v.email, password } };
}

export async function resetPasswordAction(_p: UserActionState, fd: FormData): Promise<UserActionState> {
  const me = await requireAdmin();
  const userId = String(fd.get('userId'));
  const password = await genTempPassword();
  const email = await withTenant(me.company.id, async (tx) => {
    const [u] = await tx.update(schema.users).set({ passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true })
      .where(and(eq(schema.users.id, userId), eq(schema.users.companyId, me.company.id))).returning();
    if (u) await audit(tx, { companyId: me.company.id, userId: me.id, action: 'user.password_reset', entity: 'user', entityId: u.id });
    return u?.email;
  });
  if (!email) return { error: 'User not found' };
  return { temp: { email, password } };
}

export async function toggleActiveAction(_p: UserActionState, fd: FormData): Promise<UserActionState> {
  const me = await requireAdmin();
  const t = DICT[await getLang()];
  const userId = String(fd.get('userId'));
  if (userId === me.id) return { error: t.users.errSelf };
  const max = me.company.subscription?.maxUsers ?? 0;
  const err = await withTenant(me.company.id, async (tx) => {
    const [u] = await tx.select().from(schema.users).where(and(eq(schema.users.id, userId), eq(schema.users.companyId, me.company.id)));
    if (!u) return 'User not found';
    if (u.active && u.role === 'company_admin' && (await otherActiveAdmins(tx, me.company.id, u.id)) === 0) return t.users.errLastAdmin;
    if (!u.active && (await activeCount(tx, me.company.id)) >= max) return t.users.seatLimit.replace('{max}', String(max));
    await tx.update(schema.users).set({ active: !u.active }).where(eq(schema.users.id, u.id));
    await audit(tx, { companyId: me.company.id, userId: me.id, action: u.active ? 'user.deactivated' : 'user.activated', entity: 'user', entityId: u.id });
    return null;
  });
  if (err) return { error: err };
  revalidatePath('/app/admin/users');
  return {};
}

export async function changeRoleAction(_p: UserActionState, fd: FormData): Promise<UserActionState> {
  const me = await requireAdmin();
  const t = DICT[await getLang()];
  const userId = String(fd.get('userId'));
  const role = String(fd.get('role'));
  if (userId === me.id) return { error: t.users.errSelf };
  if (!isValidRole(me.company.type, role)) return { error: 'Invalid role' };
  const err = await withTenant(me.company.id, async (tx) => {
    const [u] = await tx.select().from(schema.users).where(and(eq(schema.users.id, userId), eq(schema.users.companyId, me.company.id)));
    if (!u) return 'User not found';
    if (u.role === 'company_admin' && role !== 'company_admin' && u.active && (await otherActiveAdmins(tx, me.company.id, u.id)) === 0) return t.users.errLastAdmin;
    await tx.update(schema.users).set({ role }).where(eq(schema.users.id, u.id));
    await audit(tx, { companyId: me.company.id, userId: me.id, action: 'user.role_changed', entity: 'user', entityId: u.id, data: { from: u.role, to: role } });
    return null;
  });
  if (err) return { error: err };
  revalidatePath('/app/admin/users');
  return { saved: true };
}
