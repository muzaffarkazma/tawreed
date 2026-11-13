import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

try { process.loadEnvFile('.env'); } catch { /* optional */ }

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src'), '@config': resolve(__dirname, 'config'), 'server-only': resolve(__dirname, 'tests/unit/server-only-stub.ts') } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', fileParallelism: false }
});
