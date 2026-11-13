import { test, expect } from '@playwright/test';
import { shot } from './helpers';

test.describe('QA-01 Public website', () => {
  test('landing page explains the product in English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('hero-title')).toContainText('Source, buy, receive and pay');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    for (const id of ['how', 'roles', 'features', 'pricing']) await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.getByText('Procurement manager').first()).toBeVisible();
    await shot(page, '01-landing-en');
  });

  test('switching to Arabic renders right-to-left, and back', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('lang-toggle').first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('hero-title')).toContainText('اطلب واشترِ');
    await shot(page, '02-landing-ar');
    await page.getByTestId('lang-toggle').first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('pricing shows buyer and supplier plans, monthly and yearly', async ({ page }) => {
    await page.goto('/pricing');
    for (const id of ['buyer-starter', 'buyer-business', 'buyer-enterprise']) await expect(page.getByTestId(`plan-${id}`)).toBeVisible();
    await expect(page.getByTestId('plan-buyer-business').getByTestId('plan-price')).toHaveText('4,500');
    await page.getByTestId('cycle-yearly').click();
    await expect(page.getByTestId('plan-buyer-business').getByTestId('plan-price')).toHaveText('45,000');
    await page.getByTestId('aud-supplier').click();
    for (const id of ['supplier-starter', 'supplier-business', 'supplier-enterprise']) await expect(page.getByTestId(`plan-${id}`)).toBeVisible();
    await shot(page, '03-pricing-suppliers-yearly');
    await page.getByTestId('choose-supplier-business').click();
    await expect(page).toHaveURL(/\/signup\?plan=supplier-business&cycle=yearly/);
  });

  test('app pages are protected when logged out', async ({ page }) => {
    for (const p of ['/app', '/app/admin/users', '/platform']) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('unknown plan in sign-up link goes back to pricing', async ({ page }) => {
    await page.goto('/signup?plan=does-not-exist');
    await expect(page).toHaveURL(/\/pricing/);
  });
});
