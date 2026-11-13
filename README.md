# Tawreed — AI procurement network (Releases 1–3)

Next.js 15 + PostgreSQL 16 SaaS foundation for the Tawreed B2B procurement network.

**Release 1 includes**
- Bilingual public website (English / Arabic, right-to-left) with product story and pricing
- Subscription plans for **buyers and suppliers** (monthly / yearly, SAR + 15% VAT)
- Company sign-up → invoice → **Moyasar** checkout (sandbox or live) or **bypass** test mode
- Company workspace: admin creates users and roles (no emails — temporary passwords shown on screen, forced change at first login), seat limits per plan, company profile, billing and plan changes, invoices
- Role-based dashboards for 6 buyer roles and 4 supplier roles
- Platform super-admin: all companies, revenue (MRR), suspend / reactivate, activity log
- **AI layer** that works with an OpenAI key, a Claude key, or both (automatic fallback)
- Tenant isolation enforced **inside PostgreSQL** with row-level security, plus an audit log of every action

**Release 2: sourcing**
- Requests in plain words (English or Arabic) → AI structures them into line items priced against the Tawreed price index (built-in parser when no AI key is set)
- Procurement triage: buy matching lines now from live offers, send the rest to an RFQ
- RFQs with automatic supplier matching (category, city, rating, local content, verification), sealed bidding, Q&A shared with all bidders (AI drafts answers), early close
- Quote comparison matrix with index benchmark, Tawreed score and recommendation, "Ask AI" explanation, price negotiation (counter-offer %), award with justification
- Finance approval above the company threshold (approve / return with comment, budget check, AI risk summary), purchase order issue
- Supplier side: opportunities inbox, quote builder with index-based price assistant, questions, accept/decline price requests, win/loss

**Release 3: market and fulfilment**
- Live market: supplier offers with three payment-term prices, stock and minimum order, price vs index; buy now (binding order) or counter-offer; monthly purchase limit enforced
- Order case page shared by buyer and supplier: whose-turn banner, role-based action panel, case timeline, live activity, auto-refresh
- Supplier accept → ready to ship (delivery note, certificates) → buyer logistics books the recommended carrier → tracking map and ETA → proof of delivery
- Goods receipt (short deliveries), quality inspection (pass / partial / reject with NCR and replacement)
- ZATCA e-invoice from accepted quantities (Phase 1 QR, UUID, hash), 3-way match, auto-pay under the company limit, manual payment release
- Supplier rating, disputes with 48 h SLA, notifications bell, "My tasks" inbox on the dashboard
- Platform admin: disputes desk with evidence-based suggestion, price index (pin/unpin values), supplier verification, network KPIs, **AI settings (platform only — companies never see AI configuration)**

## 0. Upgrading from Release 1

Copy the contents of this package over your Release 1 folder (replace files when asked; your `.env` is not included and stays as it is), then:

```bash
npm install          # adds the QR code library
npm run db:migrate   # adds the Release 2/3 tables, sequences and row-level security
npm run db:seed      # adds the price index, 3 more demo suppliers and live offers (safe to run again)
npm run dev
```
Your existing companies, users, subscriptions and invoices are kept. `/app/admin/ai` now simply redirects to the dashboard; AI settings live at `/platform/ai`.

---

## 1. Run locally (development)

Requirements: Node.js 22+, PostgreSQL 16.

```bash
cp .env.example .env            # then edit values (see section 3)
npm install
npm run db:migrate              # creates tables + row-level security
npm run db:seed                 # plans, platform admin, demo companies
npm run dev                     # http://localhost:3000
```

Create the database first if needed:
```sql
CREATE ROLE tawreed LOGIN PASSWORD 'tawreed';
CREATE DATABASE tawreed OWNER tawreed;
```

## 2. Deploy

Full guide: **[deploy/DEPLOY.md](deploy/DEPLOY.md)**: cloud VPS with Docker (recommended), VPS with Node + PM2, or cPanel shared hosting, with Nginx/HTTPS, backups and updates.

Quick version (VPS with Docker):
```bash
cp .env.example .env            # set APP_URL, SESSION_SECRET, POSTGRES_PASSWORD, POSTGRES_ADMIN_PASSWORD, SEED_DEMO=false
docker compose up -d --build    # PostgreSQL + migrate/seed + app on 127.0.0.1:3000
```
Then put Nginx in front (`deploy/nginx-tawreed.conf`) and run `certbot --nginx`.

## 3. Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public URL (used for payment callbacks) |
| `SESSION_SECRET` | Random string, 32+ chars (`openssl rand -hex 32`). The app refuses to start sessions in production without it |
| `PAYMENT_MODE` | `bypass` (no card, instant activation), `sandbox` (Moyasar test keys), `live` |
| `MOYASAR_PUBLISHABLE_KEY` / `MOYASAR_SECRET_KEY` | From the Moyasar dashboard (`pk_test_…`/`sk_test_…` for sandbox) |
| `AI_PROVIDER` | `auto`, `openai`, `anthropic`, or `mock` |
| `AI_PREFERRED` | When both keys are set: which goes first (`anthropic` or `openai`) |
| `AI_FALLBACK` | `true` = retry on the other provider if the first fails |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI key and model |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude key and model |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Platform admin created by `db:seed` |
| `SEED_DEMO` | `false` to skip demo companies (use in production) |

### AI — one config file
`config/ai.config.ts` is the single place that decides which model answers. Every feature calls `aiComplete()` / `aiJson()` from `src/lib/ai`, never a provider directly.
- Only an OpenAI key → OpenAI. Only a Claude key → Claude. Both → `AI_PREFERRED` first, the other as fallback.
- Every AI call is logged in `ai_calls` (provider, model, latency, tokens, errors).
- Test it in the app: **Platform admin → AI settings → Run test** (platform super admin only; companies never see AI settings).

### Plans and prices
Edit `config/plans.ts` (prices in SAR excluding VAT, user limits, features in English and Arabic), then run `npm run db:seed` — plans are upserted; existing subscriptions keep working.

## 4. Moyasar sandbox — 10-minute check

1. In the Moyasar dashboard, copy your **test** keys into `.env`, set `PAYMENT_MODE=sandbox` and `APP_URL` to the URL your browser uses.
2. Restart the app, choose a plan, sign up, and pay on the checkout page.
3. Test cards (any future expiry, any 3-digit CVC, two-word cardholder name):

| Card | Number | Result |
| --- | --- | --- |
| Visa | 4111 1111 1111 1111 | Success |
| mada | 4201 3201 1111 1010 | Success |
| Mastercard | 5421 0801 0100 0000 | Success |
| Visa | 4123 1200 0000 0000 | Declined |

After the card step Moyasar returns to `/api/payments/moyasar/callback`. The server **fetches the payment from Moyasar with the secret key** and only activates when status is `paid`, currency is SAR, and the amount equals the invoice total. Replayed or forged callbacks are rejected or ignored.

## 5. Demo accounts (after `db:seed`)

| Who | Email | Password |
| --- | --- | --- |
| Platform admin | admin@tawreed.local | Admin@12345 |
| Buyer company admin (Al-Noor Construction) | admin@alnoor.demo | Demo@12345 |
| Procurement / Finance / Quality / Logistics / Buyer | procurement@ · finance@ · quality@ · logistics@ · buyer@ alnoor.demo | Demo@12345 |
| Supplier company admin (Gulf Industrial) | admin@gulfindustrial.demo | Demo@12345 |
| Supplier sales / operations / finance | sales@ · ops@ · finance@ gulfindustrial.demo | Demo@12345 |
| Supplier: Al-Jazira Building Materials | admin@ · sales@ · ops@ · finance@ aljazira.demo | Demo@12345 |
| Supplier: Riyadh Steel Trading | admin@ · sales@ riyadhsteel.demo | Demo@12345 |
| Supplier: Safety First Trading | admin@ · sales@ safetyfirst.demo | Demo@12345 |

**Try the full flow in 10 minutes:** buyer@alnoor.demo → Requests → New request → "Use an example" → Structure with AI → Submit. procurement@alnoor.demo → triage (buy helmets from the market, RFQ the rest). sales@gulfindustrial.demo and sales@aljazira.demo → Opportunities → quote. Procurement → Close bidding → Award. finance@alnoor.demo → Approvals. Procurement → Issue PO. Then follow the "Your turn" banner on the order: ops@ (supplier) → logistics@ → buyer@ → quality@ → finance@ (supplier) → finance@ (buyer) → buyer@ rates.

Change these passwords (or seed with `SEED_DEMO=false`) before any public deployment.

## 6. Tests

```bash
npm run test:unit      # AI routing, pricing/VAT, Moyasar, row-level security, requirement parser, ZATCA QR, scoring (needs DATABASE_URL)
npm run build && npm run test:e2e   # 46 browser scenarios across two companies and all roles; resets the tawreed_test database
node scripts/qa-report.mjs          # writes qa/QA_REPORT.md from the last run
```
The end-to-end suite starts its own servers (bypass and sandbox modes) and a local stand-in for the Moyasar API, so it runs without internet or keys. Create the test database once: `CREATE DATABASE tawreed_test OWNER tawreed;`

## 7. Project structure

```
config/            ai.config.ts · plans.ts · app.config.ts   ← the files you edit
src/db/            schema.ts (tables) · index.ts (withTenant / withSystem)
drizzle/           SQL migrations + rls.sql (row-level security)
src/lib/           auth, billing, moyasar, roles, i18n, ai/ (openai, anthropic, mock)
src/lib/ops/       Release 2/3 business rules: services.ts (every step), flow.ts (order state machine),
                   structure.ts (AI/rules parser), matching.ts (supplier match, quote scoring), zatca.ts, tasks.ts
src/app/           pages: / pricing signup checkout login app/* (requests rfqs approvals market offers
                   opportunities orders invoices disputes settings notifications) platform/* (ai disputes index)
src/app/actions/   server actions (signup, auth, users, admin, platform)
tests/             unit (vitest) and e2e (Playwright)
```

## 8. Security notes
- Each company's rows are filtered by PostgreSQL row-level security (`app.tenant_id` per transaction); a missing `WHERE` cannot leak another company's data.
- Passwords hashed with bcrypt; sessions are signed, HTTP-only cookies re-validated against the database on every request (deactivation and suspension take effect immediately).
- Login is throttled (5 failed attempts → 15-minute lock, per server instance; use a shared store such as Redis when running several instances).
- Card data never touches this server (Moyasar's hosted form).
- `PAYMENT_MODE=bypass` activates subscriptions without payment — never use it on a public production site.
