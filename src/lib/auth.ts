import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { and, eq, inArray } from 'drizzle-orm';
import { withSystem, schema } from '@/db';
import { getAppConfig } from '@config/app.config';
import { audit } from './audit';

const COOKIE = 'tw_session';
const key = () => {
  const secret = getAppConfig().sessionSecret;
  if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret.startsWith('dev-only') || secret.startsWith('change-me'))) {
    throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters in production.');
  }
  return new TextEncoder().encode(secret);
};

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
  company: null | {
    id: string; name: string; type: 'buyer' | 'supplier'; status: string; crNumber: string; vatNumber: string; city: string; phone: string | null;
    subscription: null | { id: string; planId: string; planName: string; planNameAr: string; cycle: string; status: string; maxUsers: number; currentPeriodEnd: Date | null };
  };
}

export async function createSession(userId: string) {
  const hours = getAppConfig().sessionHours;
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime(`${hours}h`).sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: hours * 3600,
    secure: getAppConfig().appUrl.startsWith('https://')
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === 'string' ? payload.uid : null;
  } catch { return null; }
}

/** Loads the signed-in user fresh from the database on every request (deactivation takes effect immediately). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const uid = await sessionUserId();
  if (!uid) return null;
  return withSystem(async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, uid));
    if (!u || !u.active) return null;
    let company: CurrentUser['company'] = null;
    if (u.companyId) {
      const [c] = await tx.select().from(schema.companies).where(eq(schema.companies.id, u.companyId));
      if (!c) return null;
      const subs = await tx.select({ s: schema.subscriptions, p: schema.plans }).from(schema.subscriptions)
        .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
        .where(and(eq(schema.subscriptions.companyId, c.id), inArray(schema.subscriptions.status, ['active', 'pending'])));
      const best = subs.find((r) => r.s.status === 'active') ?? subs.at(-1);
      company = {
        id: c.id, name: c.name, type: c.type as 'buyer' | 'supplier', status: c.status, crNumber: c.crNumber, vatNumber: c.vatNumber, city: c.city, phone: c.phone,
        subscription: best ? { id: best.s.id, planId: best.p.id, planName: best.p.nameEn, planNameAr: best.p.nameAr, cycle: best.s.cycle, status: best.s.status, maxUsers: best.p.maxUsers, currentPeriodEnd: best.s.currentPeriodEnd } : null
      };
    }
    return { id: u.id, name: u.name, email: u.email, role: u.role, isPlatformAdmin: u.isPlatformAdmin, mustChangePassword: u.mustChangePassword, company };
  });
}

/**
 * Guard for app pages. Redirects when not signed in, when a password change is due,
 * when the company is not paid/active, or when the role is not allowed.
 */
export async function requireUser(opts: { roles?: string[]; platform?: boolean; allowInactiveCompany?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const path = (await headers()).get('x-pathname') ?? '';
  if (user.mustChangePassword && !path.startsWith('/change-password')) redirect('/change-password');
  if (opts.platform) {
    if (!user.isPlatformAdmin) redirect('/app');
    return user;
  }
  if (user.isPlatformAdmin) redirect('/platform');
  if (!user.company) redirect('/login');
  if (!opts.allowInactiveCompany) {
    if (user.company.status === 'suspended') redirect('/suspended');
    if (user.company.status === 'pending_payment') {
      const inv = await pendingInvoiceFor(user.company.id);
      redirect(inv ? `/checkout/${inv}` : '/pricing');
    }
  }
  if (opts.roles && !opts.roles.includes(user.role)) redirect('/app?denied=1');
  return user;
}

export async function pendingInvoiceFor(companyId: string) {
  return withSystem(async (tx) => {
    const [inv] = await tx.select({ id: schema.invoices.id }).from(schema.invoices)
      .where(and(eq(schema.invoices.companyId, companyId), eq(schema.invoices.status, 'due')));
    return inv?.id ?? null;
  });
}

// ---- login with a simple per-email throttle (per server instance) ----
const attempts = new Map<string, { n: number; until: number }>();
export function isThrottled(email: string) {
  const a = attempts.get(email);
  return !!a && a.n >= 5 && a.until > Date.now();
}
function fail(email: string) {
  const a = attempts.get(email);
  const now = Date.now();
  if (!a || a.until < now) attempts.set(email, { n: 1, until: now + 15 * 60_000 });
  else a.n += 1;
}

export async function verifyLogin(emailRaw: string, password: string): Promise<{ ok: true; userId: string; companyStatus: string | null; platform: boolean } | { ok: false; reason: 'invalid' | 'throttled' | 'inactive' }> {
  const email = emailRaw.trim().toLowerCase();
  if (isThrottled(email)) return { ok: false, reason: 'throttled' };
  return withSystem(async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.email, email));
    if (!u || !(await bcrypt.compare(password, u.passwordHash))) { fail(email); return { ok: false as const, reason: 'invalid' as const }; }
    if (!u.active) return { ok: false as const, reason: 'inactive' as const };
    let companyStatus: string | null = null;
    if (u.companyId) {
      const [c] = await tx.select({ status: schema.companies.status }).from(schema.companies).where(eq(schema.companies.id, u.companyId));
      companyStatus = c?.status ?? null;
    }
    attempts.delete(email);
    await tx.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
    await audit(tx, { companyId: u.companyId, userId: u.id, action: 'user.login' });
    return { ok: true as const, userId: u.id, companyStatus, platform: u.isPlatformAdmin };
  });
}

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
