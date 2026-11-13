// Copies Moyasar's payment form (npm: moyasar-payment-form) into public/vendor so it is served locally.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
const src = 'node_modules/moyasar-payment-form/dist';
if (existsSync(src)) {
  mkdirSync('public/vendor', { recursive: true });
  copyFileSync(`${src}/moyasar.umd.js`, 'public/vendor/moyasar.umd.js');
  copyFileSync(`${src}/moyasar.css`, 'public/vendor/moyasar.css');
  console.log('Moyasar form copied to public/vendor');
}
