-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Corrective lifecycle rules for dynamic App Center permissions.  This is a
-- forward migration: core-017 remains immutable in the migration ledger.

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS app_archive_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'permissions_app_archive_status_check'
       AND conrelid = 'public.permissions'::regclass
  ) THEN
    ALTER TABLE public.permissions
      ADD CONSTRAINT permissions_app_archive_status_check
      CHECK (app_archive_status IS NULL OR app_archive_status IN ('active', 'disabled', 'retired'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_app_permission_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  module_key text;
  old_module_key text;
  prior_status jsonb;
  lock_key bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    module_key := coalesce(nullif(btrim(OLD.config ->> 'aclModule'), ''), 'app_' || replace(OLD.id::text, '-', ''));
    PERFORM public.cleanup_dynamic_app_permissions(OLD.id, module_key);
    RETURN OLD;
  END IF;

  module_key := coalesce(nullif(btrim(NEW.config ->> 'aclModule'), ''), 'app_' || replace(NEW.id::text, '-', ''));
  IF TG_OP = 'UPDATE'
     AND OLD.config ->> 'aclModule' IS DISTINCT FROM NEW.config ->> 'aclModule' THEN
    old_module_key := coalesce(nullif(btrim(OLD.config ->> 'aclModule'), ''), 'app_' || replace(OLD.id::text, '-', ''));
  END IF;

  FOR lock_key IN
    SELECT DISTINCT hashtextextended(value, 0)
      FROM unnest(ARRAY[module_key, old_module_key]) AS module_keys(value)
     WHERE value IS NOT NULL
     ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(lock_key);
  END LOOP;

  IF TG_OP = 'UPDATE'
     AND OLD.config ->> 'aclModule' IS DISTINCT FROM NEW.config ->> 'aclModule' THEN
    -- Move permission codes in place so role_permissions keep their original
    -- assignment state across an ACL module rename, including while archived.
    UPDATE public.permissions
       SET code = CASE
         WHEN code = 'app:' || old_module_key THEN 'app:' || module_key
         ELSE 'op:' || module_key || substring(code FROM length('op:' || old_module_key) + 1)
       END,
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND (code = 'app:' || old_module_key
         OR left(code, length('op:' || old_module_key || '.')) = 'op:' || old_module_key || '.');
    UPDATE public.sys_field_acl
       SET module = module_key,
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND module = old_module_key;
  END IF;

  IF lower(coalesce(NEW.status, 'draft')) = 'archived' THEN
    -- Retire active definitions in place.  Keeping permission and grant rows
    -- preserves role assignments for a later restore; deletion is reserved
    -- for actual app deletion.
    UPDATE public.permissions
       SET app_archive_status = status,
           status = 'retired',
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND app_archive_status IS NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND lower(coalesce(OLD.status, 'draft')) = 'archived' THEN
    UPDATE public.permissions
       SET status = coalesce(app_archive_status, status),
           app_archive_status = NULL,
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND status = 'retired';
  END IF;

  -- Preserve explicit disabled/retired decisions made in the ACL screen when
  -- an app's name, config, or unrelated metadata is edited.
  SELECT coalesce(jsonb_object_agg(code, status), '{}'::jsonb)
    INTO prior_status
    FROM public.permissions
   WHERE source_app_id = NEW.id;

  PERFORM public.sync_dynamic_app_permissions(
    NEW.id,
    NEW.name,
    module_key,
    coalesce(NEW.config, '{}'::jsonb)
  );

  UPDATE public.permissions p
     SET status = prior_status ->> p.code,
         updated_at = clock_timestamp()
   WHERE p.source_app_id = NEW.id
     AND prior_status ? p.code
     AND prior_status ->> p.code IN ('disabled', 'retired');
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_app_permission_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.sync_app_permission_lifecycle() FROM PUBLIC;
