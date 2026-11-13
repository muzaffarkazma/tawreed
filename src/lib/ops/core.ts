import 'server-only';
import { sql } from 'drizzle-orm';
import { withSystem, schema, type Tx } from '@/db';
import type { CurrentUser } from '@/lib/auth';

export const VAT = 0.15;
export const vatOf = (h: number) => Math.round(h * VAT);
export const lineTotal = (qty: number, unitHalalas: number) => Math.round(qty * unitHalalas);
export const sarIn = (sar: number | string) => Math.round(Number(sar) * 100);

/** Next document number, e.g. PO-2026-000012. */
export async function nextNo(tx: Tx, seq: string, prefix: string, pad = 6) {
  const r = await tx.execute(sql.raw(`select nextval('${seq}') as n`));
  const n = Number((r.rows[0] as { n: string }).n);
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(pad, '0')}`;
}

export type Actor = { name: string; role: string };
/** Supplier-side roles are stored as "s:<role>" so the activity feed can colour them like the prototype. */
export const actorOf = (u: CurrentUser): Actor => ({ name: u.name, role: u.company?.type === 'supplier' ? `s:${u.role}` : u.role });

/** Prototype role colours: buyer blue, procurement green, supplier amber-brown, finance violet, quality red, logistics teal, admin grey. */
export function roleVar(role: string | null | undefined, side?: 'buyer' | 'supplier') {
  if (!role) return 'var(--r-admin)';
  if (role.startsWith('s:') || side === 'supplier') return 'var(--r-supplier)';
  return ({ buyer: 'var(--r-buyer)', procurement: 'var(--r-pm)', finance: 'var(--r-finance)', quality: 'var(--r-quality)', logistics: 'var(--r-logistics)' } as Record<string, string>)[role] ?? 'var(--r-admin)';
}
export const initials = (name: string) => name.replace(/^(Al|Eng|Dr)[-. ]/i, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export async function logEvent(tx: Tx, e: { refType: 'request' | 'rfq' | 'order'; refId: string; buyer: string; supplier?: string | null; actor: Actor; en: string; ar: string }) {
  await tx.insert(schema.caseEvents).values({
    refType: e.refType, refId: e.refId, buyerCompanyId: e.buyer, supplierCompanyId: e.supplier ?? null,
    actorName: e.actor.name, actorRole: e.actor.role, textEn: e.en, textAr: e.ar
  });
}

/** Notifications are written after the business transaction commits (they may target the other company). */
export class Outbox {
  private items: (typeof schema.notifications.$inferInsert)[] = [];
  notify(companyId: string, roles: string[], en: string, ar: string, link: string) {
    this.items.push({ companyId, roles, titleEn: en, titleAr: ar, link });
  }
  async flush() {
    if (!this.items.length) return;
    const items = this.items;
    this.items = [];
    await withSystem((tx) => tx.insert(schema.notifications).values(items));
  }
}

// ---------------- permissions ----------------
const BUYER_PERMS: Record<string, string[]> = {
  'request.create': ['buyer', 'procurement'],
  'request.triage': ['procurement'],
  'rfq.manage': ['procurement'],
  'approval.decide': ['finance'],
  'market.buy': ['buyer', 'procurement'],
  'limits.edit': ['finance'],
  'order.logistics': ['logistics'],
  'order.receive': ['buyer', 'procurement'],
  'order.qc': ['quality'],
  'order.pay': ['finance'],
  'order.rate': ['buyer', 'procurement'],
  'invoice.view': ['finance'],
  'dispute.raise': ['buyer', 'procurement', 'finance', 'quality', 'logistics'],
  'order.view': ['buyer', 'procurement', 'finance', 'quality', 'logistics']
};
const SUPPLIER_PERMS: Record<string, string[]> = {
  'quote.submit': ['sales'],
  'offer.manage': ['sales'],
  'order.fulfil': ['operations'],
  'invoice.issue': ['finance'],
  'invoice.view': ['finance'],
  'dispute.raise': ['sales', 'operations', 'finance'],
  'order.view': ['sales', 'operations', 'finance']
};

export function can(u: CurrentUser | null, perm: string): boolean {
  if (!u?.company || u.company.status !== 'active') return false;
  const table = u.company.type === 'buyer' ? BUYER_PERMS : SUPPLIER_PERMS;
  if (!(perm in table)) return false;
  return u.role === 'company_admin' || table[perm].includes(u.role);
}

/** Roles that should be notified for a permission (company admins always see everything). */
export function rolesFor(type: 'buyer' | 'supplier', perm: string) {
  const table = type === 'buyer' ? BUYER_PERMS : SUPPLIER_PERMS;
  return ['company_admin', ...(table[perm] ?? [])];
}
