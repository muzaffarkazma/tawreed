CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"rfq_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"amount_halalas" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"justification" text DEFAULT '' NOT NULL,
	"comment" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"text_en" text NOT NULL,
	"text_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"cities_served" text[] DEFAULT '{}' NOT NULL,
	"rating" numeric(3, 2) DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"local_content" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"approval_threshold_halalas" integer DEFAULT 5000000 NOT NULL,
	"auto_pay_limit_halalas" integer DEFAULT 2000000 NOT NULL,
	"monthly_limit_halalas" integer DEFAULT 50000000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counter_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"term" text NOT NULL,
	"unit_halalas" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"order_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"order_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"supplier_name" text NOT NULL,
	"raised_by_company_id" uuid NOT NULL,
	"raised_by_name" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"sla_due_at" timestamp with time zone NOT NULL,
	"suggestion" text,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reads_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"title_en" text NOT NULL,
	"title_ar" text NOT NULL,
	"link" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"item" text NOT NULL,
	"spec" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"index_key" text,
	"unit" text NOT NULL,
	"city" text NOT NULL,
	"qty_available" numeric(14, 3) NOT NULL,
	"min_qty" numeric(14, 3) NOT NULL,
	"price_adv_halalas" integer NOT NULL,
	"price_nd_halalas" integer NOT NULL,
	"price_30_halalas" integer NOT NULL,
	"lead_days" integer DEFAULT 2 NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item" text NOT NULL,
	"spec" text DEFAULT '' NOT NULL,
	"unit" text NOT NULL,
	"index_key" text,
	"qty" numeric(14, 3) NOT NULL,
	"unit_halalas" integer NOT NULL,
	"received_qty" numeric(14, 3),
	"accepted_qty" numeric(14, 3)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"kind" text NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"request_id" uuid,
	"rfq_id" uuid,
	"quote_id" uuid,
	"offer_id" uuid,
	"payment_term" text NOT NULL,
	"delivery_city" text NOT NULL,
	"origin_city" text NOT NULL,
	"lead_days" integer DEFAULT 7 NOT NULL,
	"status" text NOT NULL,
	"replacement" boolean DEFAULT false NOT NULL,
	"subtotal_halalas" integer NOT NULL,
	"vat_halalas" integer NOT NULL,
	"total_halalas" integer NOT NULL,
	"docs" jsonb,
	"rating" integer,
	"rating_tags" text[],
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_index" (
	"key" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"item_en" text NOT NULL,
	"item_ar" text NOT NULL,
	"unit_en" text NOT NULL,
	"unit_ar" text NOT NULL,
	"city" text NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"value_halalas" integer NOT NULL,
	"change_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overridden" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"checklist" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"ncr_number" text,
	"inspector_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"rfq_line_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"unit_halalas" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"lead_days" integer NOT NULL,
	"valid_days" integer DEFAULT 30 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"subtotal_halalas" integer NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"negotiation" jsonb,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item" text NOT NULL,
	"spec" text DEFAULT '' NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"index_key" text,
	"est_unit_halalas" integer DEFAULT 0 NOT NULL,
	"route" text,
	"order_id" uuid,
	"rfq_id" uuid
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"project" text,
	"cost_center" text,
	"delivery_city" text NOT NULL,
	"need_by" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"structured_by" text,
	"estimated_halalas" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"match_score" integer DEFAULT 0 NOT NULL,
	"match_reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item" text NOT NULL,
	"spec" text DEFAULT '' NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"index_key" text,
	"est_unit_halalas" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"request_id" uuid,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"delivery_city" text NOT NULL,
	"need_by" text,
	"deadline" timestamp with time zone NOT NULL,
	"terms" text DEFAULT 'DAP site, Net 30' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"awarded_quote_id" uuid,
	"award_note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"carrier" text NOT NULL,
	"vehicle" text NOT NULL,
	"waybill" text NOT NULL,
	"cost_halalas" integer DEFAULT 0 NOT NULL,
	"dispatched_at" timestamp with time zone NOT NULL,
	"eta_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"pod_name" text,
	"pod_note" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"supplier_company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"uuid" text NOT NULL,
	"hash" text NOT NULL,
	"qr" text NOT NULL,
	"lines" jsonb NOT NULL,
	"subtotal_halalas" integer NOT NULL,
	"vat_halalas" integer NOT NULL,
	"total_halalas" integer NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"match" jsonb,
	"paid_at" timestamp with time zone,
	"payment_ref" text,
	"auto_paid" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_invites" ADD CONSTRAINT "rfq_invites_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_questions" ADD CONSTRAINT "rfq_questions_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_invoices" ADD CONSTRAINT "trade_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appr_buyer_idx" ON "approvals" USING btree ("buyer_company_id");--> statement-breakpoint
CREATE INDEX "ce_ref_idx" ON "case_events" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_number_unique" ON "disputes" USING btree ("number");--> statement-breakpoint
CREATE INDEX "notif_company_idx" ON "notifications" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_number_unique" ON "offers" USING btree ("number");--> statement-breakpoint
CREATE INDEX "offers_supplier_idx" ON "offers" USING btree ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "ol_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("buyer_company_id");--> statement-breakpoint
CREATE INDEX "orders_supplier_idx" ON "orders" USING btree ("supplier_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_unique" ON "quotes" USING btree ("rfq_id","supplier_company_id");--> statement-breakpoint
CREATE INDEX "rl_request_idx" ON "request_lines" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_number_unique" ON "requests" USING btree ("number");--> statement-breakpoint
CREATE INDEX "requests_buyer_idx" ON "requests" USING btree ("buyer_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_unique" ON "rfq_invites" USING btree ("rfq_id","supplier_company_id");--> statement-breakpoint
CREATE INDEX "invite_supplier_idx" ON "rfq_invites" USING btree ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "rfql_rfq_idx" ON "rfq_lines" USING btree ("rfq_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rfqs_number_unique" ON "rfqs" USING btree ("number");--> statement-breakpoint
CREATE INDEX "rfqs_buyer_idx" ON "rfqs" USING btree ("buyer_company_id");--> statement-breakpoint
CREATE INDEX "ship_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ti_number_unique" ON "trade_invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "ti_order_idx" ON "trade_invoices" USING btree ("order_id");