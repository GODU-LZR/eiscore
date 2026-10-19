-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 EISCore contributors
-- Owner-run test only: psql -X -v ON_ERROR_STOP=1 -f verify-sales.sql
-- Every synthetic row is created and removed inside this rolled-back transaction.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';
DO $test_environment$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.system_configs
    WHERE key = 'deployment_identity' AND value ->> 'enterpriseId' = 'yayu'
  ) THEN
    RAISE EXCEPTION 'This fixture requires the explicitly identified independent test database';
  END IF;
END
$test_environment$;

SET LOCAL ROLE web_user;
DO $sales_payment_contract$
DECLARE
  marker text := 'EIS-VERIFY-' || gen_random_uuid()::text;
  customer_id uuid;
  order_id uuid;
  schedule_id uuid;
  second_schedule_id uuid;
  payment_id uuid;
BEGIN
  INSERT INTO public.sales_customers (customer_no, name)
  VALUES (marker, '验收事务临时客户') RETURNING id INTO customer_id;
  INSERT INTO public.sales_orders (
    order_no, customer_id, customer_name, product_name, quantity, unit_price, total_amount
  ) VALUES (marker, customer_id, '验收事务临时客户', '验收事务临时产品', 1, 100, 100)
  RETURNING id INTO order_id;
  INSERT INTO public.sales_receivable_schedule (
    schedule_no, customer_id, customer_name, order_id, installment_no, planned_amount, due_date
  ) VALUES (marker || '-1', customer_id, '验收事务临时客户', order_id, 1, 100, CURRENT_DATE - 3)
  RETURNING id INTO schedule_id;
  INSERT INTO public.sales_receivable_schedule (
    schedule_no, customer_id, customer_name, order_id, installment_no, planned_amount, due_date
  ) VALUES (marker || '-2', customer_id, '验收事务临时客户', order_id, 2, 100, CURRENT_DATE + 3)
  RETURNING id INTO second_schedule_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.v_sales_receivable_aging a WHERE a.id = schedule_id
      AND a.outstanding_amount = 100 AND a.overdue_days = 3 AND a.aging_status = '逾期'
  ) THEN RAISE EXCEPTION 'Unpaid past-due schedule aging mismatch'; END IF;

  -- Pending payments must not reduce the receivable.
  INSERT INTO public.sales_payments (
    payment_no, customer_id, customer_name, order_id, schedule_id, amount, verify_status
  ) VALUES (marker, customer_id, '验收事务临时客户', order_id, schedule_id, 40, '待核销')
  RETURNING id INTO payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_receivable_schedule s WHERE s.id = schedule_id
      AND s.received_amount = 0 AND s.received_date IS NULL AND s.schedule_status = '逾期'
  ) THEN RAISE EXCEPTION 'Unverified payment was counted'; END IF;

  UPDATE public.sales_payments SET verify_status = '部分核销', payment_date = CURRENT_DATE - 1
  WHERE id = payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_receivable_schedule s WHERE s.id = schedule_id
      AND s.received_amount = 40 AND s.received_date = CURRENT_DATE - 1
      AND s.schedule_status = '部分收款'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.v_sales_receivable_aging a WHERE a.id = schedule_id
      AND a.outstanding_amount = 60 AND a.overdue_days = 3 AND a.aging_status = '逾期'
  ) THEN RAISE EXCEPTION 'Verified partial payment or aging mismatch'; END IF;

  UPDATE public.sales_payments SET amount = 100, verify_status = '已核销', payment_date = CURRENT_DATE
  WHERE id = payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.v_sales_receivable_aging a WHERE a.id = schedule_id
      AND a.received_amount = 100 AND a.outstanding_amount = 0
      AND a.overdue_days = 0 AND a.aging_status = '已收款'
      AND a.received_date = CURRENT_DATE
  ) THEN RAISE EXCEPTION 'Full-payment synchronization mismatch'; END IF;

  -- Moving a payment must recompute both the old and new schedule.
  UPDATE public.sales_payments SET schedule_id = second_schedule_id WHERE id = payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_receivable_schedule s WHERE s.id = schedule_id
      AND s.received_amount = 0 AND s.received_date IS NULL AND s.schedule_status = '逾期'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sales_receivable_schedule s WHERE s.id = second_schedule_id
      AND s.received_amount = 100 AND s.schedule_status = '已收款'
  ) THEN RAISE EXCEPTION 'Payment reassignment left an incorrect balance'; END IF;

  UPDATE public.sales_payments SET status = 'deleted' WHERE id = payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_receivable_schedule s WHERE s.id = second_schedule_id
      AND s.received_amount = 0 AND s.received_date IS NULL AND s.schedule_status = '待收款'
  ) THEN RAISE EXCEPTION 'Soft-deleted payment was counted'; END IF;

  UPDATE public.sales_payments SET status = 'active', amount = 30 WHERE id = payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_receivable_schedule s WHERE s.id = second_schedule_id
      AND s.received_amount = 30 AND s.schedule_status = '部分收款'
  ) THEN RAISE EXCEPTION 'Restored payment did not refresh balance'; END IF;

  DELETE FROM public.sales_payments WHERE id = payment_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.v_sales_receivable_aging a WHERE a.id = second_schedule_id
      AND a.received_amount = 0 AND a.outstanding_amount = 100
      AND a.received_date IS NULL AND a.aging_status = '待收款'
  ) THEN RAISE EXCEPTION 'Deleted payment left an incorrect balance'; END IF;
END
$sales_payment_contract$;
ROLLBACK;
\echo 'PASS: sales payment insert/update/reassignment/soft-delete/delete and aging; all synthetic rows rolled back.'
