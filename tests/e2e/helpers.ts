import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('qa/screenshots', { recursive: true });
export const shot = (page: Page, name: string) => page.screenshot({ path: `qa/screenshots/${name}.png`, fullPage: true });

export async function login(page: Page, email: string, password: string, base = '') {
  await page.goto(`${base}/login`);
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  // wait until the login finished: either we left /login or an error is shown
  await Promise.race([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15_000 }),
    page.getByTestId('login-error').waitFor({ timeout: 15_000 })
  ]).catch(() => undefined);
}

export async function logout(page: Page) {
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);
}

export interface Co { name: string; cr: string; vat: string; city: string; adminName: string; email: string; password: string }

/** Fills the sign-up form for a plan and submits. Leaves the page on /checkout/<invoiceId>. */
export async function signup(page: Page, planId: string, cycle: 'monthly' | 'yearly', co: Co, base = '') {
  await page.goto(`${base}/signup?plan=${planId}&cycle=${cycle}`);
  await page.getByTestId('f-name').fill(co.name);
  await page.getByTestId('f-cr').fill(co.cr);
  await page.getByTestId('f-vat').fill(co.vat);
  await page.getByTestId('f-city').fill(co.city);
  await page.getByTestId('f-adminName').fill(co.adminName);
  await page.getByTestId('f-email').fill(co.email);
  await page.getByTestId('f-password').fill(co.password);
  await page.getByTestId('signup-submit').click();
  await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}/);
  return page.url().split('/checkout/')[1].split('?')[0];
}

/** Changes the temporary password at first login. */
export async function firstLoginChange(page: Page, temp: string, next: string) {
  await expect(page).toHaveURL(/\/change-password/);
  await page.getByTestId('cp-current').fill(temp);
  await page.getByTestId('cp-next').fill(next);
  await page.getByTestId('cp-confirm').fill(next);
  await page.getByTestId('cp-submit').click();
}
