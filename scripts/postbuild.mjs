// Standalone output needs static assets and public/ copied next to server.js.
import { cpSync, existsSync } from 'node:fs';
if (existsSync('.next/standalone')) {
  cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
  cpSync('public', '.next/standalone/public', { recursive: true });
  console.log('Standalone server ready: node .next/standalone/server.js');
}
