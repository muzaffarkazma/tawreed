# Tawreed Releases 1–3 — QA report

Run: 2026-11-13 12:19 UTC · 46 of 46 end-to-end scenarios passed · duration 132 s

Environment: production build (standalone server), PostgreSQL 16 with row-level security, two app servers (PAYMENT_MODE=bypass and PAYMENT_MODE=sandbox), local stand-in for the Moyasar API, AI_PROVIDER=mock.

## End-to-end scenarios

| # | Area | Scenario | Result | Time |
| --- | --- | --- | --- | --- |
| 1 | QA-01 Public website | landing page explains the product in English | Pass | 1.0 s |
| 2 | QA-01 Public website | switching to Arabic renders right-to-left, and back | Pass | 1.4 s |
| 3 | QA-01 Public website | pricing shows buyer and supplier plans, monthly and yearly | Pass | 1.0 s |
| 4 | QA-01 Public website | app pages are protected when logged out | Pass | 1.1 s |
| 5 | QA-01 Public website | unknown plan in sign-up link goes back to pricing | Pass | 0.5 s |
| 6 | QA-02 Company purchase, onboarding and team | sign-up rejects invalid CR and VAT numbers | Pass | 1.0 s |
| 7 | QA-02 Company purchase, onboarding and team | sign-up rejects an email that already has an account | Pass | 0.8 s |
| 8 | QA-02 Company purchase, onboarding and team | company buys Business monthly: invoice is SAR 4,500 + 15% VAT and activation opens the workspace | Pass | 2.0 s |
| 9 | QA-02 Company purchase, onboarding and team | admin creates team members; each gets a one-time temporary password | Pass | 3.1 s |
| 10 | QA-02 Company purchase, onboarding and team | new user must change the temporary password, then sees only their role | Pass | 2.8 s |
| 11 | QA-02 Company purchase, onboarding and team | finance and quality users land on their own dashboards | Pass | 2.9 s |
| 12 | QA-02 Company purchase, onboarding and team | admin changes a role, deactivates a user (login blocked) and resets a password | Pass | 4.8 s |
| 13 | QA-02 Company purchase, onboarding and team | admin can update the company profile; CR and VAT stay locked | Pass | 2.0 s |
| 14 | QA-02 Company purchase, onboarding and team | admin upgrades to Enterprise yearly through checkout | Pass | 2.4 s |
| 15 | QA-02 Company purchase, onboarding and team | AI settings are not part of a company workspace (platform admin only) | Pass | 1.8 s |
| 16 | QA-02 Company purchase, onboarding and team | a seat limit stops a small supplier plan from adding too many users | Pass | 2.5 s |
| 17 | QA-02 Company purchase, onboarding and team | a company admin cannot open another company’s invoice | Pass | 1.4 s |
| 18 | QA-03 Moyasar payments | sandbox checkout shows Moyasar test cards and the card form | Pass | 1.4 s |
| 19 | QA-03 Moyasar payments | callback with a wrong amount is rejected and nothing is activated | Pass | 1.3 s |
| 20 | QA-03 Moyasar payments | a declined card shows the gateway message | Pass | 1.2 s |
| 21 | QA-03 Moyasar payments | a forged "status=paid" in the URL does not activate (payment unknown to Moyasar) | Pass | 1.4 s |
| 22 | QA-03 Moyasar payments | a verified paid payment activates the company; replaying it is harmless | Pass | 2.3 s |
| 23 | QA-04 Platform admin and security | platform admin sees all companies and revenue | Pass | 1.0 s |
| 24 | QA-04 Platform admin and security | suspending a company locks its users out; reactivating restores access | Pass | 3.8 s |
| 25 | QA-04 Platform admin and security | platform admin owns the AI settings: provider status and a live test | Pass | 1.2 s |
| 26 | QA-04 Platform admin and security | company users cannot open the platform admin | Pass | 1.3 s |
| 27 | QA-04 Platform admin and security | platform admin cannot be used as a company account | Pass | 1.2 s |
| 28 | QA-04 Platform admin and security | five wrong passwords lock the email for 15 minutes | Pass | 3.6 s |
| 29 | QA-04 Platform admin and security | Arabic workspace renders right-to-left for a signed-in user | Pass | 1.4 s |
| 30 | QA-05 Release 2: request → RFQ → award → PO | buyer describes a need in plain words; AI structures it into priced lines | Pass | 2.0 s |
| 31 | QA-05 Release 2: request → RFQ → award → PO | procurement sees the task, buys helmets from the live market and sends the rest to an RFQ | Pass | 3.3 s |
| 32 | QA-05 Release 2: request → RFQ → award → PO | supplier A asks a question; procurement answers it for all bidders | Pass | 5.3 s |
| 33 | QA-05 Release 2: request → RFQ → award → PO | two suppliers submit sealed quotes; prices stay hidden until bidding closes | Pass | 7.7 s |
| 34 | QA-05 Release 2: request → RFQ → award → PO | supplier accepts the price request; procurement awards and it goes to Finance | Pass | 4.0 s |
| 35 | QA-05 Release 2: request → RFQ → award → PO | Finance returns, procurement re-awards, Finance approves; PO is issued | Pass | 7.6 s |
| 36 | QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute | supplier operations accepts the PO and marks it ready | Pass | 2.2 s |
| 37 | QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute | buyer logistics books the recommended carrier, tracks it and confirms delivery | Pass | 2.4 s |
| 38 | QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute | buyer posts a short goods receipt; quality accepts part of it | Pass | 3.6 s |
| 39 | QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute | supplier finance issues the ZATCA e-invoice for accepted quantities; buyer finance matches and pays | Pass | 3.9 s |
| 40 | QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute | buyer rates the supplier, raises a short-delivery dispute; Tawreed resolves it | Pass | 5.3 s |
| 41 | QA-06 Release 3: fulfilment, quality, e-invoice, payment, dispute | market order (helmets) is fulfilled and paid automatically under the auto-pay limit | Pass | 7.8 s |
| 42 | QA-07 Live market, counter-offers and purchase limits | supplier posts an offer priced from the index | Pass | 1.6 s |
| 43 | QA-07 Live market, counter-offers and purchase limits | buyer counters; supplier accepts and a binding market order is created | Pass | 3.6 s |
| 44 | QA-07 Live market, counter-offers and purchase limits | Finance lowers the monthly limit and a market buy above it is blocked | Pass | 8.1 s |
| 45 | QA-07 Live market, counter-offers and purchase limits | Arabic: the order case page renders right-to-left | Pass | 2.4 s |
| 46 | QA-07 Live market, counter-offers and purchase limits | another company cannot open this order | Pass | 0.9 s |

## Unit and database tests

35 of 35 passed.

| File | Test | Result |
| --- | --- | --- |
| ai.test.ts | AI provider selection › only an OpenAI key -> OpenAI | Pass |
| ai.test.ts | AI provider selection › only a Claude key -> Claude | Pass |
| ai.test.ts | AI provider selection › both keys, auto -> preferred first, then the other | Pass |
| ai.test.ts | AI provider selection › fallback off -> single provider | Pass |
| ai.test.ts | AI provider selection › forced provider without its key falls back to the other key | Pass |
| ai.test.ts | AI provider selection › no keys -> nothing configured | Pass |
| ai.test.ts | AI provider selection › mock mode ignores keys | Pass |
| ai.test.ts | AI calls › uses the first provider when it works | Pass |
| ai.test.ts | AI calls › falls back to the other provider when the first fails | Pass |
| ai.test.ts | AI calls › throws a clear error when every provider fails | Pass |
| ai.test.ts | AI calls › throws when no key is configured | Pass |
| ai.test.ts | AI calls › aiJson parses JSON from either provider, even inside a code fence | Pass |
| ai.test.ts | AI calls › parseJsonLoose rejects non-JSON | Pass |
| ai.test.ts | OpenAI and Claude adapters send the right request › OpenAI: bearer key, chat/completions, json mode | Pass |
| ai.test.ts | OpenAI and Claude adapters send the right request › Claude: x-api-key, anthropic-version, messages API | Pass |
| ai.test.ts | OpenAI and Claude adapters send the right request › surfaces provider error messages | Pass |
| billing.test.ts | pricing › adds 15% VAT in halalas | Pass |
| billing.test.ts | pricing › formats SAR in both languages | Pass |
| billing.test.ts | Moyasar payment verification › accepts a paid payment for the exact amount | Pass |
| billing.test.ts | Moyasar payment verification › rejects a failed payment with the gateway message | Pass |
| billing.test.ts | Moyasar payment verification › rejects a wrong amount | Pass |
| billing.test.ts | Moyasar payment verification › rejects a wrong currency | Pass |
| billing.test.ts | Moyasar payment verification › rejects a payment made for another invoice | Pass |
| ops.test.ts | requirement parser (no AI provider) › turns plain English into priced lines matched to the right index row | Pass |
| ops.test.ts | requirement parser (no AI provider) › prefers the delivery city when the same item is indexed in several cities | Pass |
| ops.test.ts | requirement parser (no AI provider) › parses Arabic | Pass |
| ops.test.ts | ZATCA QR › encodes the 5 Phase-1 TLV tags and decodes back | Pass |
| ops.test.ts | scoring and matching › can recommend a supplier that is not the cheapest | Pass |
| ops.test.ts | scoring and matching › drops suppliers that cover none of the categories | Pass |
| ops.test.ts | scoring and matching › recommends exactly one carrier | Pass |
| ops.test.ts | order flow › every step except closed belongs to one side with a permission | Pass |
| tenant-isolation.test.ts | row-level security › without a tenant context, nothing is visible | Pass |
| tenant-isolation.test.ts | row-level security › a tenant sees only its own users and company | Pass |
| tenant-isolation.test.ts | row-level security › a tenant cannot update or delete another tenant's rows | Pass |
| tenant-isolation.test.ts | row-level security › a tenant cannot insert rows into another tenant | Pass |

## Screenshots

- `qa/screenshots/01-landing-en.png`
- `qa/screenshots/02-landing-ar.png`
- `qa/screenshots/03-pricing-suppliers-yearly.png`
- `qa/screenshots/04-checkout-bypass.png`
- `qa/screenshots/05-admin-dashboard.png`
- `qa/screenshots/06-users-created.png`
- `qa/screenshots/07-procurement-dashboard.png`
- `qa/screenshots/08-billing-after-upgrade.png`
- `qa/screenshots/09-ai-settings.png`
- `qa/screenshots/09-platform-ai-settings.png`
- `qa/screenshots/10-checkout-moyasar-sandbox.png`
- `qa/screenshots/11-platform-admin.png`
- `qa/screenshots/12-suspended.png`
- `qa/screenshots/13-dashboard-ar.png`
- `qa/screenshots/20-request-structured.png`
- `qa/screenshots/21-triage.png`
- `qa/screenshots/22-rfq-supplier-match.png`
- `qa/screenshots/23-quote-Al-Jazira.png`
- `qa/screenshots/23-quote-Gulf.png`
- `qa/screenshots/24-compare.png`
- `qa/screenshots/25-finance-approval.png`
- `qa/screenshots/26-po-issued.png`
- `qa/screenshots/27-tracking.png`
- `qa/screenshots/28-three-way-match.png`
- `qa/screenshots/29-order-case.png`
- `qa/screenshots/30-market.png`
- `qa/screenshots/31-order-arabic.png`

## Not covered by this run
- Live calls to api.moyasar.com, OpenAI and Anthropic (no internet access or keys in the test environment). The Moyasar callback logic was tested against a stand-in API; the OpenAI and Claude adapters were tested with simulated HTTP responses. Run the README section 4 check and the platform admin's AI settings → "Run test" with real keys to confirm.
- ZATCA Phase 2 clearance (Fatoora portal) needs the company's onboarding credentials; this release produces Phase 1 QR codes, UUID and invoice hash.
- The Docker image was not built in the test environment (no Docker daemon); the same standalone server it runs was used for every scenario.
