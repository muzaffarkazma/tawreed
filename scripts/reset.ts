import './load-env';
import { Pool } from 'pg';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESET !== 'yes') throw new Error('Refusing to reset a production database.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await pool.end();
  console.log('Database reset.');
}
main().catch((e) => { console.error(e); process.exit(1); });
