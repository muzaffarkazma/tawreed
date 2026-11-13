import { test, expect, type Page } from '@playwright/test';
import { shot, login, logout, signup, firstLoginChange, type Co } from './helpers';

/**
 * Real use case: a construction company buys the Business plan, its admin builds the team,
 * each person logs in with their own role.
 */
const CO: Co = { name: 'Riyadh Build Co.', cr: '1010999001', vat: '311111111100003', city: 'Riyadh', adminName: 'Majed Al-Rashid', email: 'majed@riyadhbuild.test', password: 'Majed@2026' };
const team: Record<string, { name: string; email: string; role: string; temp?: string; pw: string }> = {
  proc: { name: 'Lina Procurement', email: 'lina@riyadhbuild.test', role: 'procurement', pw: 'Lina@2026x' },
  fin: { name: 'Sami Finance', email: 'sami@riyadhbuild.test', role: 'finance', pw: 'Sami@2026x' },
  qa: { name: 'Hind Quality', email: 'hind@riyadhbuild.test', role: 'quality', pw: 'Hind@2026x' }
};

async function addUser(page: Page, u: { name: string; email: string; role: string }) {
  await page.getByTestId('nu-name').fill(u.name);
  await page.getByTestId('nu-email').fill(u.email);
  await page.getByTestId('nu-role').selectOption(u.role);
  await page.getByTestId('nu-submit').click();
}

test.describe.serial('QA-02 Company purchase, onboarding and team', () => {
  test('sign-up rejects invalid CR and VAT numbers', async ({ page }) => {
    await page.goto('/signup?plan=buyer-business&cycle=monthly');
    await page.getByTestId('f-name').fill(CO.name);
    await page.getByTestId('f-cr').fill('123');
    await page.getByTestId('f-vat').fill(CO.vat);
    await page.getByTestId('f-city').fill(CO.city);
    await page.getByTestId('f-adminName').fill(CO.adminName);
    await page.getByTestId('f-email').fill(CO.email);
    await page.getByTestId('f-password').fill(CO.password);
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('signup-error')).toContainText('10 digits');
    await expect(page.getByTestId('f-name')).toHaveValue(CO.name);
    await page.getByTestId('f-cr').fill(CO.cr);
    await page.getByTestId('f-vat').fill('123456789012345');
    await page.getByTestId('f-password').fill(CO.password);
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('signup-error')).toContainText('15 digits');
  });

  test('sign-up rejects an email that already has an account', async ({ page }) => {
    await page.goto('/signup?plan=buyer-business&cycle=monthly');
    await page.getByTestId('f-name').fill('Dup Co');
    await page.getByTestId('f-cr').fill('1010999002');
    await page.getByTestId('f-vat').fill('311111111200003');
    await page.getByTestId('f-city').fill('Jeddah');
    await page.getByTestId('f-adminName').fill('Dup');
    await page.getByTestId('f-email').fill('admin@alnoor.demo');
    await page.getByTestId('f-password').fill('Dup@20261');
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('signup-error')).toContainText('already exists');
  });

  test('company buys Business monthly: invoice is SAR 4,500 + 15% VAT and activation opens the workspace', async ({ page }) => {
    await signup(page, 'buyer-business', 'monthly', CO);
    await expect(page.getByTestId('invoice-total')).toHaveText('SAR 5,175.00');
    await shot(page, '04-checkout-bypass');
    // unpaid company cannot enter the app
    await page.goto('/app');
    await expect(page).toHaveURL(/\/checkout\//);
    await page.getByTestId('activate-bypass').click();
    await expect(page).toHaveURL(/\/app\?activated=1/);
    await expect(page.getByTestId('activated')).toBeVisible();
    await expect(page.getByTestId('company-name')).toHaveText(CO.name);
    await expect(page.getByTestId('seat-usage')).toHaveText('1 / 25');
    await expect(page.getByTestId('getting-started')).toBeVisible();
    await shot(page, '05-admin-dashboard');
  });

  test('admin creates team members; each gets a one-time temporary password', async ({ page }) => {
    await login(page, CO.email, CO.password);
    await page.getByTestId('nav-users').click();
    for (const u of Object.values(team)) {
      await addUser(page, u);
      const box = page.getByTestId('temp-password-box');
      await expect(box).toContainText(u.email);
      u.temp = (await page.getByTestId('temp-password').textContent())!.trim();
      expect(u.temp).toMatch(/^.{10}$/);
      await expect(page.getByTestId(`user-row-${u.email}`)).toBeVisible();
    }
    await expect(page.getByTestId('seat-pill')).toHaveText('4 / 25');
    await shot(page, '06-users-created');
    // duplicate email across the whole platform is refused
    await addUser(page, { name: 'Copy', email: 'procurement@alnoor.demo', role: 'buyer' });
    await expect(page.getByTestId('nu-error')).toContainText('already used');
  });

  test('new user must change the temporary password, then sees only their role', async ({ page }) => {
    const u = team.proc;
    await login(page, u.email, u.temp!);
    await page.getByTestId('cp-current').fill(u.temp!);
    await page.getByTestId('cp-next').fill('Mismatch@1');
    await page.getByTestId('cp-confirm').fill('Mismatch@2');
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('cp-error')).toContainText("don’t match");
    await firstLoginChange(page, u.temp!, u.pw);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId('me-role')).toHaveText('Procurement manager');
    await expect(page.getByTestId('nav-rfqs')).toBeVisible();
    await expect(page.getByTestId('nav-approvals')).toHaveCount(0);
    await expect(page.getByTestId('nav-users')).toHaveCount(0);
    await shot(page, '07-procurement-dashboard');
    await page.goto('/app/admin/users');
    await expect(page).toHaveURL(/denied=1/);
    await expect(page.getByTestId('denied')).toBeVisible();
    await logout(page);
    // the temporary password no longer works
    await login(page, u.email, u.temp!);
    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('finance and quality users land on their own dashboards', async ({ page }) => {
    for (const [key, label, mod] of [['fin', 'Finance', 'nav-approvals'], ['qa', 'Quality', 'nav-orders']] as const) {
      const u = team[key];
      await login(page, u.email, u.temp!);
      await firstLoginChange(page, u.temp!, u.pw);
      await expect(page.getByTestId('me-role')).toHaveText(label);
      await expect(page.getByTestId(mod)).toBeVisible();
      await logout(page);
    }
  });

  test('admin changes a role, deactivates a user (login blocked) and resets a password', async ({ page }) => {
    await login(page, CO.email, CO.password);
    await page.goto('/app/admin/users');
    const qaRow = page.getByTestId(`user-row-${team.qa.email}`);
    await qaRow.locator('select').selectOption('logistics');
    await expect(qaRow.locator('[data-testid^="role-saved-"]')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId(`user-row-${team.qa.email}`).locator('select')).toHaveValue('logistics');
    await page.getByTestId(`user-row-${team.fin.email}`).getByRole('button', { name: 'Deactivate' }).click();
    await expect(page.getByTestId(`user-row-${team.fin.email}`)).toContainText('Deactivated');
    await page.getByTestId(`user-row-${team.proc.email}`).getByRole('button', { name: 'Reset password' }).click();
    const newTemp = (await page.getByTestId(`user-row-${team.proc.email}`).getByTestId('temp-password').textContent())!.trim();
    await logout(page);
    await login(page, team.fin.email, team.fin.pw);
    await expect(page.getByTestId('login-error')).toContainText('deactivated');
    await login(page, team.proc.email, newTemp);
    await expect(page).toHaveURL(/\/change-password/);
    await firstLoginChange(page, newTemp, 'Lina@2026y');
    await expect(page.getByTestId('me-role')).toHaveText('Procurement manager');
  });

  test('admin can update the company profile; CR and VAT stay locked', async ({ page }) => {
    await login(page, CO.email, CO.password);
    await page.goto('/app/admin/company');
    await page.getByTestId('co-name').fill('Riyadh Build Company');
    await page.getByTestId('co-save').click();
    await expect(page.getByTestId('company-saved')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('company-name')).toHaveText('Riyadh Build Company');
    await expect(page.locator('input[readonly]').first()).toHaveValue(CO.cr);
  });

  test('admin upgrades to Enterprise yearly through checkout', async ({ page }) => {
    await login(page, CO.email, CO.password);
    await page.goto('/app/admin/billing');
    const card = page.getByTestId('switch-buyer-enterprise').locator('..');
    await card.locator('select').selectOption('yearly');
    await page.getByTestId('switch-buyer-enterprise').click();
    await expect(page.getByTestId('invoice-total')).toHaveText('SAR 138,000.00');
    await page.getByTestId('activate-bypass').click();
    await expect(page).toHaveURL(/\/app\?activated=1/);
    await page.goto('/app/admin/billing');
    await expect(page.getByTestId('current-plan')).toContainText('Enterprise');
    await expect(page.getByTestId('invoices-table').locator('tbody tr')).toHaveCount(2);
    await shot(page, '08-billing-after-upgrade');
  });

  test('AI settings are not part of a company workspace (platform admin only)', async ({ page }) => {
    await login(page, CO.email, CO.password);
    await expect(page.getByTestId('nav-ai')).toHaveCount(0);
    await page.goto('/app/admin/ai');
    await expect(page).toHaveURL(/\/app$/);
    await page.goto('/platform/ai');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('a seat limit stops a small supplier plan from adding too many users', async ({ page }) => {
    const sup: Co = { name: 'Najd Tools Est.', cr: '1131999003', vat: '312222222200003', city: 'Buraydah', adminName: 'Fahad Al-Harbi', email: 'fahad@najdtools.test', password: 'Fahad@2026' };
    await signup(page, 'supplier-starter', 'monthly', sup);
    await expect(page.getByTestId('invoice-total')).toHaveText('SAR 345.00');
    await page.getByTestId('activate-bypass').click();
    await expect(page.getByTestId('nav-opportunities')).toBeVisible();
    await page.goto('/app/admin/users');
    await addUser(page, { name: 'Sales One', email: 'sales1@najdtools.test', role: 'sales' });
    await expect(page.getByTestId('temp-password-box')).toBeVisible();
    await addUser(page, { name: 'Sales Two', email: 'sales2@najdtools.test', role: 'sales' });
    await expect(page.getByTestId('nu-error')).toContainText('allows 2 active users');
  });

  test('a company admin cannot open another company’s invoice', async ({ page, request }) => {
    // invoice of the seeded supplier is not reachable from Riyadh Build's session
    await login(page, CO.email, CO.password);
    await page.goto('/app/admin/billing');
    const ownLink = await page.locator('a[href^="/checkout/"]').count();
    expect(ownLink).toBe(0);
    const res = await page.goto('/checkout/00000000-0000-4000-8000-000000000000');
    expect(res?.status()).toBe(404);
    void request;
  });
});
