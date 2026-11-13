import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const g = globalThis as unknown as { __twPool?: Pool };
export const pool = g.__twPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== 'production') g.__twPool = pool;

export const db = drizzle(pool, { schema });
export type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

/**
 * Tenant-scoped access. Row-level security in PostgreSQL only returns rows of `companyId`,
 * so even a query that forgets a WHERE clause cannot read another company's data.
 */
export async function withTenant<T>(companyId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${companyId}, true)`);
    return fn(tx);
  });
}

/** System access (sign-up, login, payment callbacks, platform admin). Bypasses tenant RLS. */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass', 'on', true)`);
    return fn(tx);
  });
}

export { schema };
