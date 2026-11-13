import { test, expect } from '@playwright/test';
import { shot, login, logout, signup, type Co } from './helpers';

const SANDBOX = 'http://localhost:3101';
const setPayment = (p: object) => fetch('http://localhost:4010/__set', { method: 'POST', body: JSON.stringify(p) });

test.describe.serial('QA-03 Moyasar payments', () => {
  const co: Co = { name: 'Eastern Fit-Out Co.', cr: '2050999004', vat: '313333333300003', city: 'Khobar', adminName: 'Nawaf Al-Qahtani', email: 'nawaf@easternfit.test', password: 'Nawaf@2026' };
  let invoiceId = '';

  test('sandbox checkout shows Moyasar test cards and the card form', async ({ page }) => {
    invoiceId = await signup(page, 'buyer-starter', 'monthly', co, SANDBOX);
    await expect(page.getByTestId('test-cards')).toContainText('4111 1111 1111 1111');
    await expect(page.getByTestId('invoice-total')).toHaveText('SAR 1,725.00');
    await expect(page.getByTestId('activate-bypass')).toHaveCount(0);
    await expect(page.getByTestId('moyasar-form').locator('input').first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '10-checkout-moyasar-sandbox');
  });

  test('callback with a wrong amount is rejected and nothing is activated', async ({ page }) => {
    await login(page, co.email, co.password, SANDBOX);
    await expect(page).toHaveURL(/\/checkout\//);
    await setPayment({ id: 'pay_wrong_amount', status: 'paid', amount: 100, currency: 'SAR', metadata: { invoice_id: invoiceId } });
    await page.goto(`${SANDBOX}/api/payments/moyasar/callback?invoice=${invoiceId}&id=pay_wrong_amount&status=paid`);
    await expect(page.getByTestId('payment-error')).toContainText('Amount does not match');
  });

  test('a declined card shows the gateway message', async ({ page }) => {
    await login(page, co.email, co.password, SANDBOX);
    await setPayment({ id: 'pay_declined', status: 'failed', amount: 172500, currency: 'SAR', source: { message: 'Insufficient Funds' }, metadata: { invoice_id: invoiceId } });
    await page.goto(`${SANDBOX}/api/payments/moyasar/callback?invoice=${invoiceId}&id=pay_declined&status=failed`);
    await expect(page.getByTestId('payment-error')).toContainText('Insufficient Funds');
  });

  test('a forged "status=paid" in the URL does not activate (payment unknown to Moyasar)', async ({ page }) => {
    await login(page, co.email, co.password, SANDBOX);
    await page.goto(`${SANDBOX}/api/payments/moyasar/callback?invoice=${invoiceId}&id=pay_forged123&status=paid`);
    await expect(page.getByTestId('payment-error')).toBeVisible();
  });

  test('a verified paid payment activates the company; replaying it is harmless', async ({ page }) => {
    await setPayment({ id: 'pay_ok_001', status: 'paid', amount: 172500, currency: 'SAR', metadata: { invoice_id: invoiceId } });
    await login(page, co.email, co.password, SANDBOX);
    await page.goto(`${SANDBOX}/api/payments/moyasar/callback?invoice=${invoiceId}&id=pay_ok_001&status=paid`);
    await expect(page).toHaveURL(/\/app\?activated=1/);
    await expect(page.getByTestId('activated')).toBeVisible();
    await expect(page.getByTestId('company-name')).toHaveText(co.name);
    await page.goto(`${SANDBOX}/api/payments/moyasar/callback?invoice=${invoiceId}&id=pay_ok_001&status=paid`);
    await expect(page).toHaveURL(/\/app/);
    await page.goto(`${SANDBOX}/app/admin/billing`);
    await expect(page.getByTestId('invoices-table')).toContainText('Paid');
  });
});

test.describe.serial('QA-04 Platform admin and security', () => {
  test('platform admin sees all companies and revenue', async ({ page }) => {
    await login(page, 'admin@tawreed.local', 'Admin@12345');
    await expect(page).toHaveURL(/\/platform/);
    await expect(page.getByTestId('tenants-table')).toContainText('Al-Noor Construction Co.');
    await expect(page.getByTestId('tenants-table')).toContainText('Gulf Industrial Supplies');
    await expect(page.getByTestId('tenants-table')).toContainText('Riyadh Build Company');
    await expect(page.getByTestId('mrr')).not.toHaveText('SAR 0.00');
    await shot(page, '11-platform-admin');
  });

  test('suspending a company locks its users out; reactivating restores access', async ({ page }) => {
    await login(page, 'admin@tawreed.local', 'Admin@12345');
    await page.getByTestId('status-2050123456').click();
    await expect(page.getByTestId('tenant-2050123456')).toContainText('suspended');
    await logout(page);
    await login(page, 'sales@gulfindustrial.demo', 'Demo@12345');
    await expect(page).toHaveURL(/\/suspended/);
    await expect(page.getByTestId('suspended-title')).toBeVisible();
    await shot(page, '12-suspended');
    await page.getByRole('button').click();
    await login(page, 'admin@tawreed.local', 'Admin@12345');
    await page.getByTestId('status-2050123456').click();
    await expect(page.getByTestId('tenant-2050123456')).toContainText('active');
    await logout(page);
    await login(page, 'sales@gulfindustrial.demo', 'Demo@12345');
    await expect(page.getByTestId('me-role')).toHaveText('Sales');
  });

  test('platform admin owns the AI settings: provider status and a live test', async ({ page }) => {
    await login(page, 'admin@tawreed.local', 'Admin@12345');
    await page.getByTestId('pnav-ai').click();
    await expect(page.getByTestId('ai-order')).toHaveText('mock');
    await page.getByTestId('ai-run').click();
    await expect(page.getByTestId('ai-answer')).toContainText('Mock AI answer');
    await expect(page.getByTestId('ai-provider')).toHaveText('mock');
    await expect(page.getByTestId('ai-calls')).toContainText('platform_test');
    await shot(page, '09-platform-ai-settings');
  });

  test('company users cannot open the platform admin', async ({ page }) => {
    await login(page, 'admin@alnoor.demo', 'Demo@12345');
    await expect(page).toHaveURL(/\/app/);
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('platform admin cannot be used as a company account', async ({ page }) => {
    await login(page, 'admin@tawreed.local', 'Admin@12345');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/platform/);
  });

  test('five wrong passwords lock the email for 15 minutes', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await login(page, 'sales@riyadhsteel.demo', 'wrong-pass-1');
      await expect(page.getByTestId('login-error')).toContainText('incorrect');
    }
    await login(page, 'sales@riyadhsteel.demo', 'Demo@12345');
    await expect(page.getByTestId('login-error')).toContainText('Too many attempts');
  });

  test('Arabic workspace renders right-to-left for a signed-in user', async ({ page }) => {
    await login(page, 'admin@alnoor.demo', 'Demo@12345');
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('me-role')).toHaveText('مدير الحساب');
    await shot(page, '13-dashboard-ar');
    await page.getByTestId('lang-toggle').click();
  });
});
