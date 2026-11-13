-- Row-level security: every tenant table only shows rows of the current company
-- (set per transaction with app.tenant_id), unless app.bypass = 'on' (system operations).
-- Idempotent: safe to run after every migration.

CREATE OR REPLACE FUNCTION app_tenant_ok(cid uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass', true), '') = 'on'
      OR (cid IS NOT NULL AND cid::text = coalesce(current_setting('app.tenant_id', true), ''))
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','subscriptions','invoices','payments','audit_log','ai_calls'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_tenant_ok(company_id)) WITH CHECK (app_tenant_ok(company_id))', t);
  END LOOP;
END $$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON companies;
CREATE POLICY tenant_isolation ON companies USING (app_tenant_ok(id)) WITH CHECK (app_tenant_ok(id));

-- Invoice numbering
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;

-- ===================== Release 2 + 3 =====================
-- Company-only tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_settings','notifications','notification_reads'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_tenant_ok(company_id)) WITH CHECK (app_tenant_ok(company_id))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['requests','request_lines','approvals'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_tenant_ok(buyer_company_id)) WITH CHECK (app_tenant_ok(buyer_company_id))', t);
  END LOOP;
  -- Two-party tables: the buyer and the supplier on the row can both see it
  FOREACH t IN ARRAY ARRAY['rfq_invites','rfq_questions','quotes','quote_lines','orders','order_lines','shipments','quality_checks','trade_invoices','counter_offers','disputes','case_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_tenant_ok(buyer_company_id) OR app_tenant_ok(supplier_company_id)) WITH CHECK (app_tenant_ok(buyer_company_id) OR app_tenant_ok(supplier_company_id))', t);
  END LOOP;
END $$;

-- RFQs and their lines: the buyer, plus suppliers invited to that RFQ (read only for suppliers)
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rfqs;
DROP POLICY IF EXISTS rfq_supplier_read ON rfqs;
CREATE POLICY tenant_isolation ON rfqs USING (app_tenant_ok(buyer_company_id)) WITH CHECK (app_tenant_ok(buyer_company_id));
CREATE POLICY rfq_supplier_read ON rfqs FOR SELECT USING (EXISTS (SELECT 1 FROM rfq_invites i WHERE i.rfq_id = rfqs.id AND app_tenant_ok(i.supplier_company_id)));

ALTER TABLE rfq_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rfq_lines;
DROP POLICY IF EXISTS rfql_supplier_read ON rfq_lines;
CREATE POLICY tenant_isolation ON rfq_lines USING (app_tenant_ok(buyer_company_id)) WITH CHECK (app_tenant_ok(buyer_company_id));
CREATE POLICY rfql_supplier_read ON rfq_lines FOR SELECT USING (EXISTS (SELECT 1 FROM rfq_invites i WHERE i.rfq_id = rfq_lines.rfq_id AND app_tenant_ok(i.supplier_company_id)));

-- Market offers: every member company can browse; only the supplier changes its own offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON offers;
DROP POLICY IF EXISTS offers_browse ON offers;
CREATE POLICY tenant_isolation ON offers USING (app_tenant_ok(supplier_company_id)) WITH CHECK (app_tenant_ok(supplier_company_id));
CREATE POLICY offers_browse ON offers FOR SELECT USING (coalesce(current_setting('app.tenant_id', true), '') <> '' OR coalesce(current_setting('app.bypass', true), '') = 'on');

-- Numbering
CREATE SEQUENCE IF NOT EXISTS request_seq START 1;
CREATE SEQUENCE IF NOT EXISTS rfq_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE SEQUENCE IF NOT EXISTS mo_seq START 1;
CREATE SEQUENCE IF NOT EXISTS offer_seq START 3001;
CREATE SEQUENCE IF NOT EXISTS tinv_seq START 1;
CREATE SEQUENCE IF NOT EXISTS dispute_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ncr_seq START 1;
