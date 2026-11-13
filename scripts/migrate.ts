import './load-env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });
  await pool.query(readFileSync(join(process.cwd(), 'drizzle', 'rls.sql'), 'utf8'));
  await pool.end();
  console.log('Migrations and row-level security applied.');
}
main().catch((e) => { console.error(e); process.exit(1); });
