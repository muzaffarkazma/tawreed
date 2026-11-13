import { test, expect, type Page } from '@playwright/test';
import { shot, login, logout } from './helpers';

/**
 * Release 2 + 3 real use case, across two companies and seven roles:
 * buyer raises a requirement → procurement triages (market buy + RFQ) → suppliers quote (sealed) →
 * negotiation → award → finance approval → PO → supplier accepts/ships → logistics dispatch + POD →
 * goods receipt (short) → quality partial → e-invoice + 3-way match → payment → rating → dispute → Tawreed resolves.
 */
const PW = 'Demo@12345';
const BUYER = { admin: 'admin@alnoor.demo', buyer: 'buyer@alnoor.demo', proc: 'procurement@alnoor.demo', fin: 'finance@alnoor.demo', qa: 'quality@alnoor.demo', log: 'logistics@alnoor.demo' };
const SUP: Record<string, { sales: string; ops: string; fin: string }> = {
  'Gulf Industrial Supplies': { sales: 'sales@gulfindustrial.demo', ops: 'ops@gulfindustrial.demo', fin: 'finance@gulfindustrial.demo' },
  'Al-Jazira Building Materials': { sales: 'sales@aljazira.demo', ops: 'ops@aljazira.demo', fin: 'finance@aljazira.demo' }
};
const as = async (page: Page, email: string) => { await login(page, email, PW); await expect(page.getByTestId('me-name')).toBeVisible(); };
const out = (page: Page) => logout(page);
const turnIsMine = (page: Page) => expect(page.getByTestId('turnbar')).toHaveAttribute('data-state', 'mine');

let requestUrl = '', rfqUrl = '', poUrl = '', marketUrl = '', winner = '';

test.describe.serial('QA-05 Release 2: request → RFQ → award → PO', () => {
  test('buyer describes a need in plain words; AI structures it into priced lines', async ({ page }) => {
    await as(page, BUYER.buyer);
    await expect(page.getByTestId('nav-ai')).toHaveCount(0);
    await page.getByTestId('nav-requests').click();
    await page.getByTestId('new-request').click();
    await page.getByTestId('req-desc').fill('For the Al-Nakheel tower: 4000 bags of OPC cement, 12 tons of 16 mm rebar Grade 60 and 120 safety helmets EN 397.');
    await page.getByTestId('structure').click();
    await expect(page.getByTestId('structure-result')).toContainText('3 line items');
    await expect(page.getByTestId('draft-lines').locator('tbody tr')).toHaveCount(3);
    await expect(page.getByTestId('line-qty-0')).toHaveValue('4000');
    await expect(page.getByTestId('draft-total')).not.toHaveText(/^0\.00/);
    await shot(page, '20-request-structured');
    await page.getByTestId('req-title').fill('Al-Nakheel tower: cement, rebar, helmets');
    await page.getByTestId('submit-request').click();
    await expect(page).toHaveURL(/\/app\/requests\/[0-9a-f-]{36}\?msg=created/);
    await expect(page.getByTestId('flash-ok')).toBeVisible();
    await expect(page.getByTestId('turnbar')).toHaveAttribute('data-state', 'other');
    requestUrl = page.url().split('?')[0];
    await out(page);
  });

  test('procurement sees the task, buys helmets from the live market and sends the rest to an RFQ', async ({ page }) => {
    await as(page, BUYER.proc);
    await expect(page.getByTestId('my-tasks')).toContainText('Triage');
    await page.goto(requestUrl);
    await turnIsMine(page);
    await expect(page.getByTestId('market-match')).toBeVisible();
    await expect(page.getByTestId('pick-3')).toBeVisible();
    for (const n of [1, 2]) { const c = page.getByTestId(`pick-${n}`); if (await c.count()) await c.uncheck(); }
    await shot(page, '21-triage');
    await page.getByTestId('triage-rfq').click();
    await expect(page).toHaveURL(/\/app\/rfqs\/new\?request=/);
    await expect(page.getByTestId('supplier-list')).toContainText('Gulf Industrial Supplies');
    await expect(page.getByTestId('supplier-list')).toContainText('Al-Jazira Building Materials');
    await expect(page.getByTestId('supplier-list')).not.toContainText('Safety First Trading');
    await shot(page, '22-rfq-supplier-match');
    await page.getByTestId('publish-rfq').click();
    await expect(page).toHaveURL(/\/app\/rfqs\/[0-9a-f-]{36}\?msg=published/);
    rfqUrl = page.url().split('?')[0];
    await expect(page.getByTestId('turnbar')).toContainText('0 of');
    await page.goto(requestUrl);
    await expect(page.getByTestId('req-status')).toHaveText('Sourcing');
    await expect(page.getByTestId('req-lines')).toContainText('MO-');
    await expect(page.getByTestId('req-lines')).toContainText('RFQ-');
    marketUrl = (await page.getByTestId('req-lines').getByRole('link', { name: /MO-/ }).getAttribute('href'))!;
    await out(page);
  });

  test('supplier A asks a question; procurement answers it for all bidders', async ({ page }) => {
    const id = rfqUrl.split('/').pop();
    await as(page, SUP['Gulf Industrial Supplies'].sales);
    await expect(page.getByTestId('bell-count')).toBeVisible();
    await page.goto(`/app/opportunities/${id}`);
    await turnIsMine(page);
    await page.getByTestId('ask-question').fill('Is delivery to site on a weekday only?');
    await page.getByTestId('ask-send').click();
    await expect(page.getByTestId('question')).toContainText('weekday');
    await out(page);
    await as(page, BUYER.proc);
    await page.goto(rfqUrl);
    await page.getByTestId('answer-draft').click();
    await expect(page.getByTestId('answer-text')).not.toHaveValue('');
    await page.getByTestId('answer-text').fill('Sunday to Thursday, 7 am to 3 pm, gate 2.');
    await page.getByTestId('answer-send').click();
    await expect(page.getByTestId('question')).toContainText('gate 2');
    await out(page);
    await as(page, SUP['Al-Jazira Building Materials'].sales);
    await page.goto(`/app/opportunities/${id}`);
    await expect(page.getByTestId('answer')).toContainText('gate 2');
    await out(page);
  });

  test('two suppliers submit sealed quotes; prices stay hidden until bidding closes', async ({ page }) => {
    const id = rfqUrl.split('/').pop();
    for (const [name, fill, lead] of [['Gulf Industrial Supplies', 'fill-index', '5'], ['Al-Jazira Building Materials', 'fill-competitive', '3']] as const) {
      await as(page, SUP[name].sales);
      await page.getByTestId('nav-opportunities').click();
      await page.getByRole('link', { name: /RFQ-/ }).first().click();
      await page.getByTestId(fill).click();
      await page.getByTestId('lead').fill(lead);
      await expect(page.getByTestId('quote-total')).not.toHaveText('0.00');
      await shot(page, `23-quote-${name.split(' ')[0]}`);
      await page.getByTestId('submit-quote').click();
      await expect(page.getByTestId('flash-ok')).toContainText('Sealed quote submitted');
      await expect(page.getByTestId('turnbar')).toHaveAttribute('data-state', 'other');
      await out(page);
    }
    // an un-invited supplier cannot open the RFQ
    await as(page, 'admin@safetyfirst.demo');
    const r = await page.goto(`/app/opportunities/${id}`);
    expect(r?.status()).toBe(404);
    await page.goto('/app');
    await out(page);
    await as(page, BUYER.proc);
    await page.goto(rfqUrl);
    await expect(page.getByTestId('turnbar')).toContainText('2 of');
    await expect(page.getByTestId('compare')).toHaveCount(0);
    await page.getByTestId('close-bidding').click();
    await turnIsMine(page);
    await expect(page.getByTestId('compare')).toBeVisible();
    await expect(page.getByTestId('recommendation')).toContainText(/best overall|Award to/);
    await page.getByTestId('ask-ai-compare').click();
    await expect(page.getByTestId('ask-ai-answer')).toBeVisible();
    await shot(page, '24-compare');
    await page.getByTestId('discount-Gulf Industrial Supplies').click();
    await expect(page.getByTestId('compare')).toContainText('Asked −3%');
    await out(page);
  });

  test('supplier accepts the price request; procurement awards and it goes to Finance', async ({ page }) => {
    await as(page, SUP['Gulf Industrial Supplies'].sales);
    await expect(page.getByTestId('my-tasks')).toContainText('price request');
    await page.goto(`/app/opportunities/${rfqUrl.split('/').pop()}`);
    await page.getByTestId('neg-accept').click();
    await expect(page.getByTestId('negotiation-panel')).toHaveCount(0);
    await out(page);
    await as(page, BUYER.proc);
    await page.goto(rfqUrl);
    await expect(page.getByTestId('compare')).toContainText('Accepted −3%');
    winner = (await page.locator('[data-testid^="award-"] input:checked').locator('..').locator('bdi').textContent())!.trim();
    await page.getByTestId('award').click();
    await expect(page.getByTestId('flash-ok')).toContainText('Finance');
    await expect(page.getByTestId('rfq-status')).toHaveText('Finance approval');
    await page.goto('/app/approvals');
    await expect(page).toHaveURL(/denied=1/);
    await out(page);
  });

  test('Finance returns, procurement re-awards, Finance approves; PO is issued', async ({ page }) => {
    await as(page, BUYER.fin);
    await page.getByTestId('nav-approvals').click();
    await page.getByTestId('ask-ai-approval').click();
    await expect(page.getByTestId('ask-ai-answer')).toBeVisible();
    await page.getByTestId('approval-return').click();
    await expect(page.getByTestId('flash-err')).toContainText('comment');
    await page.getByTestId('approval-comment').fill('Confirm the mill certificate for rebar first.');
    await page.getByTestId('approval-return').click();
    await expect(page.getByTestId('flash-ok')).toContainText('Returned');
    await out(page);
    await as(page, BUYER.proc);
    await page.goto(rfqUrl);
    await expect(page.getByTestId('rfq-status')).toHaveText('Evaluation');
    await page.getByTestId('award').click();
    await out(page);
    await as(page, BUYER.fin);
    await page.getByTestId('nav-approvals').click();
    await shot(page, '25-finance-approval');
    await page.getByTestId('approval-approve').click();
    await expect(page.getByTestId('flash-ok')).toContainText('Approved');
    await out(page);
    await as(page, BUYER.proc);
    await page.goto(rfqUrl);
    await turnIsMine(page);
    await page.getByTestId('issue-po').click();
    await expect(page).toHaveURL(/\/app\/orders\/[0-9a-f-]{36}\?msg=po/);
    await expect(page.getByTestId('order-status')).toHaveText('PO issued');
    await expect(page.getByTestId('turnbar')).toHaveAttribute('data-state', 'other');
    poUrl = page.url().split('?')[0];
    await shot(page, '26-po-issued');
    await out(page);
    // losing supplier sees "not selected" (and no competitor prices)
    const loser = Object.keys(SUP).find((n) => n !== winner)!;
    await as(page, SUP[loser].sales);
    await page.goto(`/app/opportunities/${rfqUrl.split('/').pop()}`);
    await expect(page.getByTestId('quote-status')).toHaveText('Not selected');
    await out(page);
  });
});

test.describe.serial('QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute', () => {
  test('supplier operations accepts the PO and marks it ready', async ({ page }) => {
    await as(page, SUP[winner].ops);
    await expect(page.getByTestId('my-tasks')).toContainText('Accept the purchase order');
    await page.goto(poUrl);
    await turnIsMine(page);
    await page.getByTestId('accept-order').click();
    await expect(page.getByTestId('order-status')).toHaveText('Accepted');
    await page.getByTestId('mark-ready').click();
    await expect(page.getByTestId('order-status')).toHaveText('Ready to ship');
    await expect(page.getByTestId('turnbar')).toHaveAttribute('data-state', 'other');
    await out(page);
  });

  test('buyer logistics books the recommended carrier, tracks it and confirms delivery', async ({ page }) => {
    await as(page, BUYER.log);
    await page.goto(poUrl);
    await turnIsMine(page);
    await expect(page.getByTestId('carrier-rec')).toBeVisible();
    await page.getByTestId('dispatch').click();
    await expect(page.getByTestId('order-status')).toHaveText('In transit');
    await expect(page.getByTestId('tracking')).toContainText('waybill');
    await shot(page, '27-tracking');
    await page.getByTestId('pod-name').fill('Site engineer Badr');
    await page.getByTestId('confirm-pod').click();
    await expect(page.getByTestId('order-status')).toHaveText('Delivered');
    await expect(page.getByTestId('tracking')).toContainText('Site engineer Badr');
    await out(page);
  });

  test('buyer posts a short goods receipt; quality accepts part of it', async ({ page }) => {
    await as(page, BUYER.buyer);
    await page.goto(poUrl);
    await turnIsMine(page);
    await page.getByTestId('rec-1').fill('3900');
    await page.getByTestId('post-grn').click();
    await expect(page.getByTestId('order-status')).toHaveText('Quality check');
    await out(page);
    await as(page, BUYER.qa);
    await page.goto(poUrl);
    await turnIsMine(page);
    await page.getByTestId('qc-partial').click();
    await page.getByTestId('acc-1').fill('3850');
    await page.getByTestId('qc-submit').click();
    await expect(page.getByTestId('flash-err')).toContainText('Describe');
    await page.getByTestId('qc-partial').click();
    await page.getByTestId('acc-1').fill('3850');
    await page.getByTestId('qc-notes').fill('50 bags torn and wet');
    await page.getByTestId('qc-submit').click();
    await expect(page.getByTestId('order-status')).toHaveText('Awaiting invoice');
    await expect(page.getByTestId('qc-record')).toContainText('Partially accepted');
    await out(page);
  });

  test('supplier finance issues the ZATCA e-invoice for accepted quantities; buyer finance matches and pays', async ({ page }) => {
    await as(page, SUP[winner].fin);
    await page.goto(poUrl);
    await turnIsMine(page);
    await page.getByTestId('issue-invoice').click();
    await expect(page.getByTestId('einvoice')).toContainText('INV-T-');
    await expect(page.getByTestId('einvoice-qr')).toBeVisible();
    await expect(page.getByTestId('order-status')).toHaveText('Invoice review');
    await out(page);
    await as(page, BUYER.fin);
    await page.goto(poUrl);
    await turnIsMine(page);
    await expect(page.getByTestId('match-ok')).toBeVisible();
    await shot(page, '28-three-way-match');
    await page.getByTestId('pay-ref').fill('TRX-889201');
    await page.getByTestId('pay').click();
    await expect(page.getByTestId('order-status')).toHaveText('Paid');
    await expect(page.getByTestId('einvoice')).toContainText('TRX-889201');
    await page.getByTestId('nav-invoices').click();
    await expect(page.getByTestId('invoices-table')).toContainText('Paid');
    await out(page);
  });

  test('buyer rates the supplier, raises a short-delivery dispute; Tawreed resolves it', async ({ page }) => {
    await as(page, BUYER.buyer);
    await page.goto(poUrl);
    await page.locator('[data-testid="stars"] label').nth(1).click();
    await page.getByTestId('rate').click();
    await expect(page.getByTestId('order-status')).toHaveText('Closed');
    await expect(page.getByTestId('turnbar')).toHaveAttribute('data-state', 'done');
    await page.getByTestId('dispute-toggle').click();
    await page.getByTestId('dispute-type').selectOption('short');
    await page.getByTestId('dispute-desc').fill('100 bags short on the delivery note');
    await page.getByTestId('dispute-submit').click();
    await expect(page.getByTestId('dispute-open')).toContainText('DSP-');
    await expect(page.getByTestId('timeline')).toBeVisible();
    await expect(page.getByTestId('activity')).toContainText('Dispute');
    await shot(page, '29-order-case');
    await out(page);
    await login(page, 'admin@tawreed.local', 'Admin@12345');
    await page.getByTestId('pnav-disputes').click();
    await expect(page.getByTestId('dispute-suggestion')).toContainText('credit note');
    await page.getByTestId('resolution').fill('Supplier issues a credit note for 100 bags.');
    await page.getByTestId('resolve').click();
    await expect(page.getByTestId('flash-ok')).toContainText('resolved');
    await expect(page.getByTestId('network-kpis')).toHaveCount(0);
    await page.getByTestId('pnav-overview').click();
    await expect(page.getByTestId('gmv')).not.toHaveText('SAR 0.00');
    await page.getByTestId('pnav-index').click();
    await expect(page.getByTestId('index-table')).toContainText('OPC cement');
    await out(page);
    await as(page, BUYER.buyer);
    await page.goto(poUrl);
    await expect(page.getByTestId('dispute-open')).toHaveCount(0);
    await expect(page.locator('#dispute')).toContainText('credit note');
  });

  test('market order (helmets) is fulfilled and paid automatically under the auto-pay limit', async ({ page }) => {
    await as(page, 'admin@safetyfirst.demo');
    await page.goto(marketUrl);
    await expect(page.getByTestId('order-status')).toHaveText('Accepted');
    await page.getByTestId('mark-ready').click();
    await out(page);
    await as(page, BUYER.log);
    await page.goto(marketUrl);
    await page.getByTestId('dispatch').click();
    await page.getByTestId('confirm-pod').click();
    await out(page);
    await as(page, BUYER.proc);
    await page.goto(marketUrl);
    await page.getByTestId('post-grn').click();
    await out(page);
    await as(page, BUYER.qa);
    await page.goto(marketUrl);
    await page.getByTestId('qc-submit').click();
    await out(page);
    await as(page, 'admin@safetyfirst.demo');
    await page.goto(marketUrl);
    await page.getByTestId('issue-invoice').click();
    await expect(page.getByTestId('order-status')).toHaveText('Paid');
    await expect(page.getByTestId('einvoice')).toContainText('Auto-paid');
    await out(page);
  });
});

test.describe.serial('QA-07 Live market, counter-offers and purchase limits', () => {
  test('supplier posts an offer priced from the index', async ({ page }) => {
    await as(page, SUP['Gulf Industrial Supplies'].sales);
    await page.getByTestId('nav-offers').click();
    await page.getByTestId('post-offer-toggle').click();
    await page.getByTestId('offer-index').selectOption('vest_class2');
    await expect(page.getByTestId('offer-nd')).not.toHaveValue('');
    await page.getByTestId('offer-item').fill('Hi-vis vest, orange');
    await page.getByTestId('offer-qty').fill('500');
    await page.getByTestId('offer-min').fill('20');
    await page.getByTestId('post-offer').click();
    await expect(page.getByTestId('flash-ok')).toContainText('live');
    await expect(page.getByTestId('my-offers')).toContainText('Hi-vis vest, orange');
    await out(page);
  });

  test('buyer counters; supplier accepts and a binding market order is created', async ({ page }) => {
    await as(page, BUYER.buyer);
    await page.getByTestId('nav-market').click();
    await page.getByTestId('market-search').fill('orange');
    await page.getByTestId('market-search').press('Enter');
    const card = page.locator('[data-testid^="offer-OF-"]').first();
    await expect(card).toContainText('Hi-vis vest, orange');
    await expect(card.getByTestId('vs-index')).toBeVisible();
    await shot(page, '30-market');
    await card.locator('summary').click();
    await card.getByTestId('counter').click();
    await expect(page.getByTestId('flash-ok')).toContainText('Counter-offer sent');
    await expect(page.getByTestId('my-counters')).toContainText('Pending');
    await out(page);
    await as(page, SUP['Gulf Industrial Supplies'].sales);
    await page.getByTestId('nav-offers').click();
    await page.getByTestId('counter-accept').click();
    await expect(page).toHaveURL(/\/app\/orders\/.*msg=counter/);
    await expect(page.getByTestId('order-status')).toHaveText('Accepted');
    await out(page);
  });

  test('Finance lowers the monthly limit and a market buy above it is blocked', async ({ page }) => {
    await as(page, BUYER.fin);
    await page.goto('/app/settings');
    await page.getByTestId('limit-monthly').fill('1000');
    await page.getByTestId('save-limits').click();
    await expect(page.getByTestId('flash-ok')).toBeVisible();
    await out(page);
    await as(page, BUYER.buyer);
    await page.getByTestId('nav-market').click();
    { const o = page.locator('[data-testid^="offer-OF-"]').first(); await o.locator('summary').click(); await o.getByTestId('buy').click(); }
    await expect(page.getByTestId('flash-err')).toContainText('monthly purchase limit');
    await out(page);
    await as(page, BUYER.fin);
    await page.goto('/app/settings');
    await page.getByTestId('limit-monthly').fill('500000');
    await page.getByTestId('save-limits').click();
    await out(page);
    await as(page, BUYER.buyer);
    await page.getByTestId('nav-market').click();
    { const o = page.locator('[data-testid^="offer-OF-"]').first(); await o.locator('summary').click(); await o.getByTestId('buy').click(); }
    await expect(page).toHaveURL(/\/app\/orders\/.*msg=bought/);
    await out(page);
  });

  test('Arabic: the order case page renders right-to-left', async ({ page }) => {
    await as(page, BUYER.buyer);
    await page.goto(poUrl);
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.goto(poUrl);
    await expect(page.getByTestId('order-status')).toHaveText('مغلق');
    await expect(page.getByTestId('turnbar')).toContainText('اكتمل');
    await shot(page, '31-order-arabic');
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('another company cannot open this order', async ({ page }) => {
    await as(page, 'admin@riyadhsteel.demo');
    const r = await page.goto(poUrl);
    expect(r?.status()).toBe(404);
  });
});
