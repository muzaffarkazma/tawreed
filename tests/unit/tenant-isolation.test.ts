/**
 * Runs against the real PostgreSQL database in DATABASE_URL (seeded demo data).
 * Proves row-level security: a company's transaction cannot read or change another company's rows,
 * even when the query has no WHERE clause.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { withTenant, withSystem, schema, pool, db } from '@/db';

const ids = async () => withSystem(async (tx) => {
  const rows = await tx.select().from(schema.companies);
  const a = rows.find((r) => r.crNumber === '1010456789')!;
  const b = rows.find((r) => r.crNumber === '2050123456')!;
  return { a: a.id, b: b.id };
});

afterAll(async () => { await pool.end(); });

describe('row-level security', () => {
  it('without a tenant context, nothing is visible', async () => {
    const r = await db.execute(sql`select count(*)::int as n from users`);
    expect((r.rows[0] as { n: number }).n).toBe(0);
  });
  it('a tenant sees only its own users and company', async () => {
    const { a, b } = await ids();
    const users = await withTenant(a, (tx) => tx.select().from(schema.users));
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.companyId === a)).toBe(true);
    const companies = await withTenant(a, (tx) => tx.select().from(schema.companies));
    expect(companies.map((c) => c.id)).toEqual([a]);
    const other = await withTenant(a, (tx) => tx.select().from(schema.users).where(eq(schema.users.companyId, b)));
    expect(other).toHaveLength(0);
  });
  it('a tenant cannot update or delete another tenant\'s rows', async () => {
    const { a, b } = await ids();
    const upd = await withTenant(a, (tx) => tx.update(schema.users).set({ name: 'hacked' }).where(eq(schema.users.companyId, b)).returning());
    expect(upd).toHaveLength(0);
    const del = await withTenant(a, (tx) => tx.delete(schema.invoices).where(eq(schema.invoices.companyId, b)).returning());
    expect(del).toHaveLength(0);
    const still = await withSystem((tx) => tx.select().from(schema.users).where(eq(schema.users.companyId, b)));
    expect(still.some((u) => u.name === 'hacked')).toBe(false);
  });
  it('a tenant cannot insert rows into another tenant', async () => {
    const { a, b } = await ids();
    await expect(withTenant(a, (tx) => tx.insert(schema.users).values({ companyId: b, email: 'x@evil.test', name: 'x', passwordHash: 'x', role: 'buyer' }))).rejects.toThrow();
  });
});
