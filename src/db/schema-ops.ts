/**
 * Release 2 + 3 tables: sourcing (requests, RFQs, quotes, approvals), the live market,
 * fulfilment (orders, shipments, quality, trade invoices, payments, ratings) and disputes.
 *
 * Money is stored in halalas (integer). Quantities are numeric (decimals allowed, e.g. 7.5 t).
 * Rows shared by a buyer and a supplier carry both company ids; row-level security
 * (drizzle/rls.sql) lets either party see them and nobody else.
 */
import { pgTable, text, uuid, integer, boolean, timestamp, jsonb, bigserial, numeric, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

const qty = (name: string) => numeric(name, { precision: 14, scale: 3, mode: 'number' });
const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Public network directory (no RLS): only what any member may see about another company. */
export const companyProfiles = pgTable('company_profiles', {
  companyId: uuid('company_id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  categories: text('categories').array().notNull().default([]),
  citiesServed: text('cities_served').array().notNull().default([]),
  rating: numeric('rating', { precision: 3, scale: 2, mode: 'number' }).notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  localContent: integer('local_content').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
  active: boolean('active').notNull().default(true),
  updatedAt: ts('updated_at').notNull().defaultNow()
});

/** Per-company rules: approvals, auto-pay and monthly purchase limit. */
export const companySettings = pgTable('company_settings', {
  companyId: uuid('company_id').primaryKey(),
  approvalThresholdHalalas: integer('approval_threshold_halalas').notNull().default(5_000_000),
  autoPayLimitHalalas: integer('auto_pay_limit_halalas').notNull().default(2_000_000),
  monthlyLimitHalalas: integer('monthly_limit_halalas').notNull().default(50_000_000),
  updatedAt: ts('updated_at').notNull().defaultNow()
});

/** Product benchmark prices (global, no RLS). */
export const priceIndex = pgTable('price_index', {
  key: text('key').primaryKey(),
  category: text('category').notNull(),
  itemEn: text('item_en').notNull(),
  itemAr: text('item_ar').notNull(),
  unitEn: text('unit_en').notNull(),
  unitAr: text('unit_ar').notNull(),
  city: text('city').notNull(),
  keywords: text('keywords').array().notNull().default([]),
  valueHalalas: integer('value_halalas').notNull(),
  changePct: numeric('change_pct', { precision: 6, scale: 2, mode: 'number' }).notNull().default(0),
  sourceCount: integer('source_count').notNull().default(0),
  history: jsonb('history').$type<number[]>().notNull().default([]),
  overridden: boolean('overridden').notNull().default(false),
  updatedAt: ts('updated_at').notNull().defaultNow()
});

export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  number: text('number').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  project: text('project'),
  costCenter: text('cost_center'),
  deliveryCity: text('delivery_city').notNull(),
  needBy: text('need_by'),
  status: text('status').notNull().default('submitted'), // submitted | sourcing | done | cancelled
  structuredBy: text('structured_by'), // ai provider name or 'rules'
  estimatedHalalas: integer('estimated_halalas').notNull().default(0),
  createdBy: uuid('created_by').notNull(),
  createdByName: text('created_by_name').notNull(),
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [uniqueIndex('requests_number_unique').on(t.number), index('requests_buyer_idx').on(t.buyerCompanyId)]);

export const requestLines = pgTable('request_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  lineNo: integer('line_no').notNull(),
  item: text('item').notNull(),
  spec: text('spec').notNull().default(''),
  qty: qty('qty').notNull(),
  unit: text('unit').notNull(),
  category: text('category').notNull().default('other'),
  indexKey: text('index_key'),
  estUnitHalalas: integer('est_unit_halalas').notNull().default(0),
  route: text('route'), // null | market | rfq
  orderId: uuid('order_id'),
  rfqId: uuid('rfq_id')
}, (t) => [index('rl_request_idx').on(t.requestId)]);

export const rfqs = pgTable('rfqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  buyerName: text('buyer_name').notNull(),
  requestId: uuid('request_id'),
  number: text('number').notNull(),
  title: text('title').notNull(),
  deliveryCity: text('delivery_city').notNull(),
  needBy: text('need_by'),
  deadline: ts('deadline').notNull(),
  terms: text('terms').notNull().default('DAP site, Net 30'),
  status: text('status').notNull().default('open'), // open | evaluation | pending_approval | approved | ordered | cancelled
  awardedQuoteId: uuid('awarded_quote_id'),
  awardNote: text('award_note'),
  createdBy: uuid('created_by').notNull(),
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [uniqueIndex('rfqs_number_unique').on(t.number), index('rfqs_buyer_idx').on(t.buyerCompanyId)]);

export const rfqLines = pgTable('rfq_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  lineNo: integer('line_no').notNull(),
  item: text('item').notNull(),
  spec: text('spec').notNull().default(''),
  qty: qty('qty').notNull(),
  unit: text('unit').notNull(),
  category: text('category').notNull().default('other'),
  indexKey: text('index_key'),
  estUnitHalalas: integer('est_unit_halalas').notNull().default(0)
}, (t) => [index('rfql_rfq_idx').on(t.rfqId)]);

export const rfqInvites = pgTable('rfq_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  matchScore: integer('match_score').notNull().default(0),
  matchReason: text('match_reason').notNull().default(''),
  status: text('status').notNull().default('invited'), // invited | viewed | quoted | declined
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [uniqueIndex('invite_unique').on(t.rfqId, t.supplierCompanyId), index('invite_supplier_idx').on(t.supplierCompanyId)]);

export const rfqQuestions = pgTable('rfq_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  answeredAt: ts('answered_at'),
  createdAt: ts('created_at').notNull().defaultNow()
});

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  leadDays: integer('lead_days').notNull(),
  validDays: integer('valid_days').notNull().default(30),
  notes: text('notes').notNull().default(''),
  subtotalHalalas: integer('subtotal_halalas').notNull(),
  discountPct: numeric('discount_pct', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
  status: text('status').notNull().default('submitted'), // submitted | awarded | lost
  negotiation: jsonb('negotiation').$type<null | { targetPct: number; status: 'pending' | 'accepted' | 'declined'; at: string }>(),
  submittedBy: uuid('submitted_by').notNull(),
  submittedAt: ts('submitted_at').notNull().defaultNow()
}, (t) => [uniqueIndex('quote_unique').on(t.rfqId, t.supplierCompanyId)]);

export const quoteLines = pgTable('quote_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  rfqLineId: uuid('rfq_line_id').notNull(),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  unitHalalas: integer('unit_halalas').notNull()
});

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  rfqId: uuid('rfq_id').notNull(),
  quoteId: uuid('quote_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  amountHalalas: integer('amount_halalas').notNull(), // incl. VAT
  status: text('status').notNull().default('pending'), // pending | approved | returned
  requestedBy: uuid('requested_by').notNull(),
  justification: text('justification').notNull().default(''),
  comment: text('comment'),
  decidedBy: uuid('decided_by'),
  decidedAt: ts('decided_at'),
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [index('appr_buyer_idx').on(t.buyerCompanyId)]);

export const offers = pgTable('offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  item: text('item').notNull(),
  spec: text('spec').notNull().default(''),
  category: text('category').notNull(),
  indexKey: text('index_key'),
  unit: text('unit').notNull(),
  city: text('city').notNull(),
  qtyAvailable: qty('qty_available').notNull(),
  minQty: qty('min_qty').notNull(),
  priceAdvHalalas: integer('price_adv_halalas').notNull(),
  priceNdHalalas: integer('price_nd_halalas').notNull(),
  price30Halalas: integer('price_30_halalas').notNull(),
  leadDays: integer('lead_days').notNull().default(2),
  validUntil: ts('valid_until').notNull(),
  status: text('status').notNull().default('active'), // active | paused | sold_out
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [uniqueIndex('offers_number_unique').on(t.number), index('offers_supplier_idx').on(t.supplierCompanyId)]);

export const counterOffers = pgTable('counter_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  buyerName: text('buyer_name').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  qty: qty('qty').notNull(),
  term: text('term').notNull(), // adv | nd | r30
  unitHalalas: integer('unit_halalas').notNull(),
  status: text('status').notNull().default('pending'), // pending | accepted | declined
  orderId: uuid('order_id'),
  createdBy: uuid('created_by').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  decidedAt: ts('decided_at')
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  kind: text('kind').notNull(), // po | market
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  buyerName: text('buyer_name').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  requestId: uuid('request_id'),
  rfqId: uuid('rfq_id'),
  quoteId: uuid('quote_id'),
  offerId: uuid('offer_id'),
  paymentTerm: text('payment_term').notNull(), // adv | nd | r30
  deliveryCity: text('delivery_city').notNull(),
  originCity: text('origin_city').notNull(),
  leadDays: integer('lead_days').notNull().default(7),
  status: text('status').notNull(), // issued | accepted | ready | in_transit | delivered | received | qc_passed | invoiced | paid | closed | cancelled
  replacement: boolean('replacement').notNull().default(false),
  subtotalHalalas: integer('subtotal_halalas').notNull(),
  vatHalalas: integer('vat_halalas').notNull(),
  totalHalalas: integer('total_halalas').notNull(),
  docs: jsonb('docs').$type<{ deliveryNote?: string; packages?: number; certificates?: string; notes?: string }>(),
  rating: integer('rating'),
  ratingTags: text('rating_tags').array(),
  createdBy: uuid('created_by').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [uniqueIndex('orders_number_unique').on(t.number), index('orders_buyer_idx').on(t.buyerCompanyId), index('orders_supplier_idx').on(t.supplierCompanyId)]);

export const orderLines = pgTable('order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  lineNo: integer('line_no').notNull(),
  item: text('item').notNull(),
  spec: text('spec').notNull().default(''),
  unit: text('unit').notNull(),
  indexKey: text('index_key'),
  qty: qty('qty').notNull(),
  unitHalalas: integer('unit_halalas').notNull(),
  receivedQty: qty('received_qty'),
  acceptedQty: qty('accepted_qty')
}, (t) => [index('ol_order_idx').on(t.orderId)]);

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  carrier: text('carrier').notNull(),
  vehicle: text('vehicle').notNull(),
  waybill: text('waybill').notNull(),
  costHalalas: integer('cost_halalas').notNull().default(0),
  dispatchedAt: ts('dispatched_at').notNull(),
  etaAt: ts('eta_at').notNull(),
  deliveredAt: ts('delivered_at'),
  podName: text('pod_name'),
  podNote: text('pod_note'),
  active: boolean('active').notNull().default(true)
}, (t) => [index('ship_order_idx').on(t.orderId)]);

export const qualityChecks = pgTable('quality_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  decision: text('decision').notNull(), // pass | partial | reject
  checklist: jsonb('checklist').$type<{ label: string; ok: boolean }[]>().notNull(),
  notes: text('notes').notNull().default(''),
  ncrNumber: text('ncr_number'),
  inspectorName: text('inspector_name').notNull(),
  createdAt: ts('created_at').notNull().defaultNow()
});

export const tradeInvoices = pgTable('trade_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  number: text('number').notNull(),
  uuid: text('uuid').notNull(),
  hash: text('hash').notNull(),
  qr: text('qr').notNull(),
  lines: jsonb('lines').$type<{ item: string; unit: string; qty: number; unitHalalas: number }[]>().notNull(),
  subtotalHalalas: integer('subtotal_halalas').notNull(),
  vatHalalas: integer('vat_halalas').notNull(),
  totalHalalas: integer('total_halalas').notNull(),
  status: text('status').notNull().default('submitted'), // submitted | variance | paid
  match: jsonb('match').$type<{ ok: boolean; issues: string[] }>(),
  paidAt: ts('paid_at'),
  paymentRef: text('payment_ref'),
  autoPaid: boolean('auto_paid').notNull().default(false),
  issuedAt: ts('issued_at').notNull().defaultNow()
}, (t) => [uniqueIndex('ti_number_unique').on(t.number), index('ti_order_idx').on(t.orderId)]);

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  orderNumber: text('order_number').notNull(),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id').notNull(),
  buyerName: text('buyer_name').notNull(),
  supplierName: text('supplier_name').notNull(),
  raisedByCompanyId: uuid('raised_by_company_id').notNull(),
  raisedByName: text('raised_by_name').notNull(),
  type: text('type').notNull(), // short | damaged | late | invoice | other
  description: text('description').notNull(),
  status: text('status').notNull().default('open'), // open | resolved
  slaDueAt: ts('sla_due_at').notNull(),
  suggestion: text('suggestion'),
  resolution: text('resolution'),
  resolvedAt: ts('resolved_at'),
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [uniqueIndex('disputes_number_unique').on(t.number)]);

/** Who did what on a request, RFQ or order — shown as the live activity feed on case pages. */
export const caseEvents = pgTable('case_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  refType: text('ref_type').notNull(), // request | rfq | order
  refId: uuid('ref_id').notNull(),
  buyerCompanyId: uuid('buyer_company_id').notNull(),
  supplierCompanyId: uuid('supplier_company_id'),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  textEn: text('text_en').notNull(),
  textAr: text('text_ar').notNull(),
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [index('ce_ref_idx').on(t.refType, t.refId)]);

/** In-app notifications for a company, optionally narrowed to roles. */
export const notifications = pgTable('notifications', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  companyId: uuid('company_id').notNull(),
  roles: text('roles').array().notNull().default([]), // empty = everyone in the company
  titleEn: text('title_en').notNull(),
  titleAr: text('title_ar').notNull(),
  link: text('link').notNull(),
  createdAt: ts('created_at').notNull().defaultNow()
}, (t) => [index('notif_company_idx').on(t.companyId)]);

export const notificationReads = pgTable('notification_reads', {
  userId: uuid('user_id').notNull(),
  companyId: uuid('company_id').notNull(),
  seenAt: ts('seen_at').notNull().defaultNow()
}, (t) => [primaryKey({ columns: [t.userId] })]);
