-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 EISCore contributors
-- Govern existing quote-to-receivable frontend structures. Definitions were
-- inspected from the deployed schema; no business rows are copied.

CREATE TABLE public.sales_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_no text NOT NULL,
    version_no integer DEFAULT 1 NOT NULL,
    opportunity_id uuid,
    customer_id uuid,
    customer_name text NOT NULL,
    quote_title text NOT NULL,
    quote_date date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    currency text DEFAULT 'CNY'::text NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    payment_term_days integer DEFAULT 0 NOT NULL,
    delivery_terms text,
    approval_status text DEFAULT '草稿'::text NOT NULL,
    quote_status text DEFAULT '草稿'::text NOT NULL,
    owner_name text,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_quotes_amounts_check CHECK (((subtotal >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (total_amount >= (0)::numeric))),
    CONSTRAINT sales_quotes_approval_status_check CHECK ((approval_status = ANY (ARRAY['草稿'::text, '待审批'::text, '已通过'::text, '已驳回'::text, '已作废'::text]))),
    CONSTRAINT sales_quotes_payment_term_days_check CHECK ((payment_term_days >= 0)),
    CONSTRAINT sales_quotes_status_check CHECK ((quote_status = ANY (ARRAY['草稿'::text, '已发送'::text, '已接受'::text, '已拒绝'::text, '已过期'::text, '已作废'::text]))),
    CONSTRAINT sales_quotes_version_no_check CHECK ((version_no > 0))
);

CREATE TABLE public.sales_quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    line_no integer DEFAULT 10 NOT NULL,
    product_code text,
    product_name text NOT NULL,
    specification text,
    quantity numeric(14,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT '件'::text NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 13 NOT NULL,
    discount_rate numeric(5,2) DEFAULT 100 NOT NULL,
    line_amount numeric(14,2) DEFAULT 0 NOT NULL,
    delivery_date date,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_quote_items_discount_check CHECK (((discount_rate >= (0)::numeric) AND (discount_rate <= (100)::numeric))),
    CONSTRAINT sales_quote_items_price_check CHECK (((unit_price >= (0)::numeric) AND (line_amount >= (0)::numeric))),
    CONSTRAINT sales_quote_items_qty_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT sales_quote_items_tax_check CHECK (((tax_rate >= (0)::numeric) AND (tax_rate <= (100)::numeric)))
);

CREATE TABLE public.sales_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_no text NOT NULL,
    contract_version integer DEFAULT 1 NOT NULL,
    quote_id uuid,
    quote_no text,
    customer_id uuid,
    customer_name text NOT NULL,
    contract_title text NOT NULL,
    sign_date date,
    effective_date date,
    expiry_date date,
    contract_amount numeric(14,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CNY'::text NOT NULL,
    payment_term_days integer DEFAULT 0 NOT NULL,
    approval_status text DEFAULT '草稿'::text NOT NULL,
    signing_status text DEFAULT '未签订'::text NOT NULL,
    seller_signatory text,
    buyer_signatory text,
    attachment_url text,
    owner_name text,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_contracts_amount_check CHECK ((contract_amount >= (0)::numeric)),
    CONSTRAINT sales_contracts_approval_status_check CHECK ((approval_status = ANY (ARRAY['草稿'::text, '待审批'::text, '已通过'::text, '已驳回'::text, '已作废'::text]))),
    CONSTRAINT sales_contracts_signing_status_check CHECK ((signing_status = ANY (ARRAY['未签订'::text, '待签订'::text, '部分签订'::text, '已签订'::text, '已终止'::text]))),
    CONSTRAINT sales_contracts_term_check CHECK ((payment_term_days >= 0))
);

CREATE TABLE public.sales_contract_payment_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    node_no integer NOT NULL,
    node_name text NOT NULL,
    due_rule text DEFAULT '合同签订后'::text NOT NULL,
    due_date date,
    due_days integer DEFAULT 0 NOT NULL,
    planned_amount numeric(14,2) DEFAULT 0 NOT NULL,
    received_amount numeric(14,2) DEFAULT 0 NOT NULL,
    node_status text DEFAULT '待收款'::text NOT NULL,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_contract_payment_nodes_amount_check CHECK (((planned_amount >= (0)::numeric) AND (received_amount >= (0)::numeric))),
    CONSTRAINT sales_contract_payment_nodes_days_check CHECK ((due_days >= 0)),
    CONSTRAINT sales_contract_payment_nodes_no_check CHECK ((node_no > 0)),
    CONSTRAINT sales_contract_payment_nodes_status_check CHECK ((node_status = ANY (ARRAY['待收款'::text, '部分收款'::text, '已收款'::text, '逾期'::text, '已作废'::text])))
);

CREATE TABLE public.sales_receivable_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_no text NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    order_id uuid,
    order_no text,
    contract_id uuid,
    contract_no text,
    payment_node_id uuid,
    installment_no integer DEFAULT 1 NOT NULL,
    planned_amount numeric(14,2) DEFAULT 0 NOT NULL,
    received_amount numeric(14,2) DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    received_date date,
    schedule_status text DEFAULT '待收款'::text NOT NULL,
    owner_name text,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_receivable_schedule_amount_check CHECK (((planned_amount >= (0)::numeric) AND (received_amount >= (0)::numeric))),
    CONSTRAINT sales_receivable_schedule_installment_check CHECK ((installment_no > 0)),
    CONSTRAINT sales_receivable_schedule_status_check CHECK ((schedule_status = ANY (ARRAY['待收款'::text, '部分收款'::text, '已收款'::text, '逾期'::text, '已作废'::text])))
);

ALTER TABLE public.sales_orders
  ADD COLUMN quote_id uuid,
  ADD COLUMN quote_no text,
  ADD COLUMN contract_id uuid,
  ADD COLUMN contract_no text,
  ADD COLUMN payment_term_days integer NOT NULL DEFAULT 0,
  ADD COLUMN due_date date;
ALTER TABLE public.sales_payments ADD COLUMN schedule_id uuid;

ALTER TABLE ONLY public.sales_contract_payment_nodes
    ADD CONSTRAINT sales_contract_payment_nodes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sales_contract_payment_nodes
    ADD CONSTRAINT sales_contract_payment_nodes_unique UNIQUE (contract_id, node_no);
ALTER TABLE ONLY public.sales_contracts
    ADD CONSTRAINT sales_contracts_contract_no_key UNIQUE (contract_no);
ALTER TABLE ONLY public.sales_contracts
    ADD CONSTRAINT sales_contracts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sales_quote_items
    ADD CONSTRAINT sales_quote_items_line_unique UNIQUE (quote_id, line_no);
ALTER TABLE ONLY public.sales_quote_items
    ADD CONSTRAINT sales_quote_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sales_quotes
    ADD CONSTRAINT sales_quotes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sales_quotes
    ADD CONSTRAINT sales_quotes_quote_no_key UNIQUE (quote_no);
ALTER TABLE ONLY public.sales_quotes
    ADD CONSTRAINT sales_quotes_version_unique UNIQUE (customer_id, quote_no, version_no);
ALTER TABLE ONLY public.sales_receivable_schedule
    ADD CONSTRAINT sales_receivable_schedule_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sales_receivable_schedule
    ADD CONSTRAINT sales_receivable_schedule_schedule_no_key UNIQUE (schedule_no);
ALTER TABLE ONLY public.sales_contract_payment_nodes
    ADD CONSTRAINT sales_contract_payment_nodes_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.sales_contracts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sales_contracts
    ADD CONSTRAINT sales_contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_contracts
    ADD CONSTRAINT sales_contracts_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_contract_fk FOREIGN KEY (contract_id) REFERENCES public.sales_contracts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_quote_fk FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.sales_receivable_schedule(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_quote_items
    ADD CONSTRAINT sales_quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sales_quotes
    ADD CONSTRAINT sales_quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_quotes
    ADD CONSTRAINT sales_quotes_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.sales_opportunities(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_receivable_schedule
    ADD CONSTRAINT sales_receivable_schedule_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.sales_contracts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_receivable_schedule
    ADD CONSTRAINT sales_receivable_schedule_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_receivable_schedule
    ADD CONSTRAINT sales_receivable_schedule_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales_receivable_schedule
    ADD CONSTRAINT sales_receivable_schedule_payment_node_id_fkey FOREIGN KEY (payment_node_id) REFERENCES public.sales_contract_payment_nodes(id) ON DELETE SET NULL;
CREATE INDEX idx_sales_contract_payment_nodes_due ON public.sales_contract_payment_nodes USING btree (due_date, node_status);
CREATE INDEX idx_sales_contracts_customer ON public.sales_contracts USING btree (customer_id, sign_date DESC);
CREATE INDEX idx_sales_contracts_status ON public.sales_contracts USING btree (approval_status, signing_status);
CREATE INDEX idx_sales_orders_contract ON public.sales_orders USING btree (contract_id);
CREATE INDEX idx_sales_orders_due_date ON public.sales_orders USING btree (due_date);
CREATE INDEX idx_sales_orders_quote ON public.sales_orders USING btree (quote_id);
CREATE INDEX idx_sales_payments_schedule ON public.sales_payments USING btree (schedule_id, verify_status, status);
CREATE INDEX idx_sales_quote_items_quote ON public.sales_quote_items USING btree (quote_id, line_no);
CREATE INDEX idx_sales_quotes_customer ON public.sales_quotes USING btree (customer_id, quote_date DESC);
CREATE INDEX idx_sales_quotes_status ON public.sales_quotes USING btree (approval_status, quote_status);
CREATE INDEX idx_sales_receivable_schedule_customer ON public.sales_receivable_schedule USING btree (customer_id, due_date);
CREATE INDEX idx_sales_receivable_schedule_status ON public.sales_receivable_schedule USING btree (schedule_status, due_date);
CREATE TRIGGER trg_sales_contract_payment_nodes_updated_at BEFORE UPDATE ON public.sales_contract_payment_nodes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sales_contracts_updated_at BEFORE UPDATE ON public.sales_contracts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sales_quote_items_updated_at BEFORE UPDATE ON public.sales_quote_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sales_quotes_updated_at BEFORE UPDATE ON public.sales_quotes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sales_receivable_schedule_updated_at BEFORE UPDATE ON public.sales_receivable_schedule FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_sales_receivable_schedule(p_schedule_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_planned_amount numeric(14,2);
  v_due_date date;
  v_received_amount numeric(14,2);
  v_received_date date;
  v_schedule_status text;
BEGIN
  IF p_schedule_id IS NULL THEN RETURN; END IF;

  SELECT planned_amount, due_date
  INTO v_planned_amount, v_due_date
  FROM public.sales_receivable_schedule
  WHERE id = p_schedule_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0)::numeric(14,2), MAX(payment_date)
  INTO v_received_amount, v_received_date
  FROM public.sales_payments
  WHERE schedule_id = p_schedule_id
    AND status <> 'deleted'
    AND verify_status IN ('已核销', '部分核销');

  v_schedule_status := CASE
    WHEN v_received_amount >= v_planned_amount THEN '已收款'
    WHEN v_received_amount > 0 THEN '部分收款'
    WHEN v_due_date < CURRENT_DATE THEN '逾期'
    ELSE '待收款'
  END;

  UPDATE public.sales_receivable_schedule
  SET received_amount = v_received_amount,
      received_date = v_received_date,
      schedule_status = v_schedule_status
  WHERE id = p_schedule_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_sales_payment_receivable_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_sales_receivable_schedule(OLD.schedule_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.schedule_id IS DISTINCT FROM NEW.schedule_id THEN
    PERFORM public.refresh_sales_receivable_schedule(OLD.schedule_id);
  END IF;
  PERFORM public.refresh_sales_receivable_schedule(NEW.schedule_id);
  RETURN NEW;
END;
$function$;



ALTER FUNCTION public.refresh_sales_receivable_schedule(uuid) OWNER TO eiscore_owner;
ALTER FUNCTION public.sync_sales_payment_receivable_schedule() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.refresh_sales_receivable_schedule(uuid) FROM PUBLIC, web_anon, web_user, eiscore_agent, eiscore_flash_agent;
REVOKE ALL ON FUNCTION public.sync_sales_payment_receivable_schedule() FROM PUBLIC, web_anon, web_user, eiscore_agent, eiscore_flash_agent;

CREATE TRIGGER trg_sales_payments_sync_receivable_schedule
  AFTER INSERT OR DELETE OR UPDATE OF schedule_id, amount, payment_date, verify_status, status
  ON public.sales_payments FOR EACH ROW
  EXECUTE FUNCTION public.sync_sales_payment_receivable_schedule();

-- Invoker views retain RLS and caller grants. The numeric aging calculation
-- follows the deployed view, with status labels aligned to the frontend.
CREATE VIEW public.v_sales_receivable_aging WITH (security_invoker = true) AS
SELECT r.*,
  GREATEST(planned_amount - received_amount, 0)::numeric(14,2) AS outstanding_amount,
  CASE
    WHEN schedule_status = '已作废' OR received_amount >= planned_amount THEN 0
    WHEN due_date < CURRENT_DATE THEN CURRENT_DATE - due_date
    ELSE 0
  END AS overdue_days,
  CASE
    WHEN schedule_status = '已作废' THEN '已作废'
    WHEN received_amount >= planned_amount THEN '已收款'
    WHEN due_date < CURRENT_DATE THEN '逾期'
    WHEN received_amount > 0 THEN '部分收款'
    ELSE '待收款'
  END AS aging_status
FROM public.sales_receivable_schedule r WHERE status <> 'deleted';
ALTER VIEW public.v_sales_receivable_aging OWNER TO eiscore_owner;
REVOKE ALL ON public.v_sales_receivable_aging FROM PUBLIC, web_anon, eiscore_flash_agent;
GRANT SELECT ON public.v_sales_receivable_aging TO web_user, eiscore_agent;

-- Match the existing single-enterprise authenticated sales boundary. Anonymous
-- and Flash identities receive no access to these additional business tables.
DO $sales_access$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sales_quotes', 'sales_quote_items', 'sales_contracts',
    'sales_contract_payment_nodes', 'sales_receivable_schedule'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO eiscore_owner', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, web_anon, web_user, eiscore_agent, eiscore_flash_agent', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO web_user', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO eiscore_agent', table_name);
    EXECUTE format('CREATE POLICY sales_authenticated ON public.%I FOR ALL TO web_user USING (true) WITH CHECK (true)', table_name);
    EXECUTE format('CREATE POLICY sales_agent ON public.%I FOR ALL TO eiscore_agent USING (session_user = ''eiscore_agent'') WITH CHECK (session_user = ''eiscore_agent'')', table_name);
  END LOOP;
END
$sales_access$;

DO $sales_acl$
DECLARE
  app record;
  operation text;
BEGIN
  FOR app IN SELECT * FROM (VALUES
    ('sales_quote', '销售报价', ARRAY['view','create','edit','delete','export','config','approve']),
    ('sales_contract', '销售合同', ARRAY['view','create','edit','delete','export','config','approve','sign']),
    ('sales_receivable', '应收与账期', ARRAY['view','create','edit','delete','export','config'])
  ) catalog(code, name, operations) LOOP
    INSERT INTO public.permissions (code, name, module, action, status)
    VALUES ('app:' || app.code, '应用-' || app.name, '应用', '进入', 'active')
    ON CONFLICT (code) DO NOTHING;
    FOREACH operation IN ARRAY app.operations LOOP
      INSERT INTO public.permissions (code, name, module, action, status)
      VALUES ('op:' || app.code || '.' || operation, app.name || '-' || operation, app.code, operation, 'active')
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
  END LOOP;
  INSERT INTO public.role_permissions (role_id, permission_id, status)
  SELECT r.id, p.id, 'active' FROM public.roles r CROSS JOIN public.permissions p
  WHERE r.code = 'super_admin' AND r.status = 'active' AND p.status = 'active'
    AND (p.code IN ('app:sales_quote','app:sales_contract','app:sales_receivable')
      OR p.code ~ '^op:sales_(quote|contract|receivable)[.]')
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END
$sales_acl$;

NOTIFY pgrst, 'reload schema';

