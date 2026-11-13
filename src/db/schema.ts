import { pgTable, text, uuid, integer, boolean, timestamp, jsonb, bigserial, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  audience: text('audience').notNull(), // buyer | supplier
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  monthlyHalalas: integer('monthly_halalas').notNull(),
  yearlyHalalas: integer('yearly_halalas').notNull(),
  maxUsers: integer('max_users').notNull(),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true)
});

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // buyer | supplier
  name: text('name').notNull(),
  crNumber: text('cr_number').notNull(),
  vatNumber: text('vat_number').notNull(),
  city: text('city').notNull(),
  phone: text('phone'),
  status: text('status').notNull().default('pending_payment'), // pending_payment | active | suspended
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [uniqueIndex('companies_cr_unique').on(t.crNumber)]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  active: boolean('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [uniqueIndex('users_email_unique').on(t.email), index('users_company_idx').on(t.companyId)]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => plans.id),
  cycle: text('cycle').notNull(), // monthly | yearly
  status: text('status').notNull().default('pending'), // pending | active | cancelled
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('subs_company_idx').on(t.companyId)]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  description: text('description').notNull(),
  subtotalHalalas: integer('subtotal_halalas').notNull(),
  vatHalalas: integer('vat_halalas').notNull(),
  totalHalalas: integer('total_halalas').notNull(),
  status: text('status').notNull().default('due'), // due | paid
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true })
}, (t) => [uniqueIndex('invoices_number_unique').on(t.number), index('inv_company_idx').on(t.companyId)]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // moyasar | bypass
  providerPaymentId: text('provider_payment_id'),
  amountHalalas: integer('amount_halalas').notNull(),
  status: text('status').notNull(), // paid | failed
  message: text('message'),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [uniqueIndex('payments_provider_id_unique').on(t.providerPaymentId), index('pay_company_idx').on(t.companyId)]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  companyId: uuid('company_id'),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('audit_company_idx').on(t.companyId)]);

export const aiCalls = pgTable('ai_calls', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  companyId: uuid('company_id'),
  userId: uuid('user_id'),
  feature: text('feature').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  ok: boolean('ok').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export * from './schema-ops';
