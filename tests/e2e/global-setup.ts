import { execSync } from 'node:child_process';

export default async function globalSetup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://tawreed:tawreed@localhost:5432/tawreed_test', NODE_ENV: 'test' };
  for (const cmd of ['npx tsx scripts/reset.ts', 'npx tsx scripts/migrate.ts', 'npx tsx --tsconfig tsconfig.json scripts/seed.ts']) {
    execSync(cmd, { env, stdio: 'inherit' });
  }
}
