-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Establish a stable login-user to employee-archive identity bridge.  HR row
-- scope must never be inferred from names, employee numbers or department
-- labels: only this foreign-key bridge and public.departments UUIDs are used.

CREATE TABLE hr.user_employee_links (
  user_id integer PRIMARY KEY
    REFERENCES public.users(id) ON DELETE CASCADE,
  archive_id integer NOT NULL UNIQUE
    REFERENCES hr.archives(id) ON DELETE CASCADE,
  linked_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  linked_by integer
    REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE hr.user_employee_links IS
  'Audited one-to-one identity bridge between an authenticated user and an HR archive; never infer this link from text fields';
COMMENT ON COLUMN hr.user_employee_links.user_id IS 'Authenticated public.users identity';
COMMENT ON COLUMN hr.user_employee_links.archive_id IS 'Stable HR employee archive identity';
COMMENT ON COLUMN hr.user_employee_links.linked_by IS 'User that most recently established or changed the link';

CREATE OR REPLACE FUNCTION hr.current_user_id() RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'hr', 'pg_temp'
AS $body$
  SELECT u.id
  FROM public.users u
  CROSS JOIN LATERAL (SELECT public.document_current_claims() AS value) claims
  WHERE u.username = NULLIF(claims.value ->> 'username', '')
     OR (
       NULLIF(claims.value ->> 'username', '') IS NULL
       AND (
         u.id::text = NULLIF(claims.value ->> 'sub', '')
         OR u.username = NULLIF(claims.value ->> 'sub', '')
       )
     )
  ORDER BY CASE WHEN u.username = NULLIF(claims.value ->> 'username', '') THEN 0 ELSE 1 END
  LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION hr.current_employee_archive_id() RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'hr', 'pg_temp'
AS $body$
  SELECT l.archive_id
  FROM hr.user_employee_links l
  WHERE l.user_id = hr.current_user_id()
  LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION hr.can_access_employee(
  p_archive_id bigint,
  p_module text
) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'hr', 'pg_temp'
AS $body$
DECLARE
  actor_id integer;
  actor_dept_id uuid;
  actor_archive_id integer;
BEGIN
  -- Signed administrator claims and an explicit role scope of all are the
  -- only paths that may see unlinked employees or temporary attendance rows.
  IF public.document_current_is_admin() THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.document_current_role_codes() role_code
    JOIN public.roles role_row
      ON lower(role_row.code) = lower(role_code.role_code)
    JOIN public.role_data_scopes scope_row
      ON scope_row.role_id = role_row.id
     AND scope_row.module = p_module
    WHERE scope_row.scope_type = 'all'
  ) THEN
    RETURN true;
  END IF;

  IF p_archive_id IS NULL OR COALESCE(btrim(p_module), '') = '' THEN
    RETURN false;
  END IF;

  actor_id := hr.current_user_id();
  IF actor_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.dept_id, link.archive_id
    INTO actor_dept_id, actor_archive_id
  FROM public.users u
  LEFT JOIN hr.user_employee_links link ON link.user_id = u.id
  WHERE u.id = actor_id;

  -- Self is the fail-closed default when no role_data_scopes row exists.
  IF actor_archive_id IS NOT NULL AND actor_archive_id::bigint = p_archive_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.document_current_role_codes() role_code
    JOIN public.roles role_row
      ON lower(role_row.code) = lower(role_code.role_code)
    JOIN public.role_data_scopes scope_row
      ON scope_row.role_id = role_row.id
     AND scope_row.module = p_module
    JOIN hr.user_employee_links target_link
      ON target_link.archive_id::bigint = p_archive_id
    JOIN public.users target_user ON target_user.id = target_link.user_id
    WHERE
      (scope_row.scope_type = 'dept'
       AND target_user.dept_id = COALESCE(scope_row.dept_id, actor_dept_id))
      OR
      (scope_row.scope_type = 'dept_tree'
       AND COALESCE(scope_row.dept_id, actor_dept_id) IS NOT NULL
       AND target_user.dept_id IN (
         SELECT public.dept_tree_ids(COALESCE(scope_row.dept_id, actor_dept_id))
       ))
  );
END;
$body$;

CREATE OR REPLACE FUNCTION hr.can_manage_employee_links() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'hr', 'pg_temp'
AS $body$
  SELECT public.document_current_is_admin()
      OR (
        EXISTS (
          SELECT 1
          FROM public.document_current_role_codes() role_code
          WHERE lower(role_code.role_code) = 'hr_admin'
        )
        AND EXISTS (
          SELECT 1
          FROM public.document_current_permissions() permission
          WHERE permission.permission_code IN (
            'op:hr_employee.create', 'op:hr_employee.edit',
            'op:hr_user.create', 'op:hr_user.edit'
          )
        )
      );
$body$;

CREATE OR REPLACE FUNCTION hr.set_user_employee_link_audit() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'hr', 'pg_temp'
AS $body$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.linked_at := now();
  ELSE
    NEW.linked_at := OLD.linked_at;
  END IF;
  NEW.updated_at := now();
  NEW.linked_by := hr.current_user_id();
  RETURN NEW;
END;
$body$;

CREATE TRIGGER user_employee_links_audit
  BEFORE INSERT OR UPDATE ON hr.user_employee_links
  FOR EACH ROW EXECUTE FUNCTION hr.set_user_employee_link_audit();

ALTER TABLE hr.user_employee_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_agent_access ON hr.user_employee_links
  FOR ALL TO eiscore_agent
  USING (session_user = 'eiscore_agent')
  WITH CHECK (session_user = 'eiscore_agent');

CREATE POLICY hr_user_employee_links_manage ON hr.user_employee_links
  FOR ALL TO web_user
  USING (hr.can_manage_employee_links())
  WITH CHECK (hr.can_manage_employee_links());

-- core-003 generated historical policy names through a formatted identifier.
-- Remove both the intended and the generated spellings before installing the
-- canonical, employee-scoped policies below.
DO $drop_legacy_hr_policies$
DECLARE
  table_name text;
  operation text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'archives', 'attendance_month_overrides', 'attendance_records',
    'attendance_shifts', 'employee_profiles'
  ] LOOP
    FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON hr.%I',
        'hr_' || table_name || '_' || operation, table_name);
      EXECUTE format('DROP POLICY IF EXISTS %I ON hr.%I',
        'hr_hr_' || table_name || '_' || operation || '_' || operation, table_name);
    END LOOP;
  END LOOP;
END
$drop_legacy_hr_policies$;

-- Employee archive and profile rows use the hr_employee scope.
CREATE POLICY hr_archives_select ON hr.archives
  FOR SELECT TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code = 'module:hr'
         OR permission.permission_code LIKE 'app:hr_%'
         OR permission.permission_code ~ '^op:hr_.*[.]view$'
    ))
    AND hr.can_access_employee(id, 'hr_employee')
  );
CREATE POLICY hr_archives_insert ON hr.archives
  FOR INSERT TO web_user
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(id, 'hr_employee')
  );
CREATE POLICY hr_archives_update ON hr.archives
  FOR UPDATE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(id, 'hr_employee')
  )
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(id, 'hr_employee')
  );
CREATE POLICY hr_archives_delete ON hr.archives
  FOR DELETE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(id, 'hr_employee')
  );

CREATE POLICY hr_employee_profiles_select ON hr.employee_profiles
  FOR SELECT TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code = 'module:hr'
         OR permission.permission_code LIKE 'app:hr_%'
         OR permission.permission_code ~ '^op:hr_.*[.]view$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_employee')
  );
CREATE POLICY hr_employee_profiles_insert ON hr.employee_profiles
  FOR INSERT TO web_user
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_employee')
  );
CREATE POLICY hr_employee_profiles_update ON hr.employee_profiles
  FOR UPDATE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_employee')
  )
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_employee')
  );
CREATE POLICY hr_employee_profiles_delete ON hr.employee_profiles
  FOR DELETE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_employee')
  );

-- Employee attendance rows use hr_attendance.  Temporary workers deliberately
-- carry no archive ID and therefore remain invisible outside all/admin scope.
CREATE POLICY hr_attendance_records_select ON hr.attendance_records
  FOR SELECT TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code = 'module:hr'
         OR permission.permission_code LIKE 'app:hr_%'
         OR permission.permission_code ~ '^op:hr_.*[.]view$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );
CREATE POLICY hr_attendance_records_insert ON hr.attendance_records
  FOR INSERT TO web_user
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );
CREATE POLICY hr_attendance_records_update ON hr.attendance_records
  FOR UPDATE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  )
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );
CREATE POLICY hr_attendance_records_delete ON hr.attendance_records
  FOR DELETE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );

CREATE POLICY hr_attendance_month_overrides_select ON hr.attendance_month_overrides
  FOR SELECT TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code = 'module:hr'
         OR permission.permission_code LIKE 'app:hr_%'
         OR permission.permission_code ~ '^op:hr_.*[.]view$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );
CREATE POLICY hr_attendance_month_overrides_insert ON hr.attendance_month_overrides
  FOR INSERT TO web_user
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );
CREATE POLICY hr_attendance_month_overrides_update ON hr.attendance_month_overrides
  FOR UPDATE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  )
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );
CREATE POLICY hr_attendance_month_overrides_delete ON hr.attendance_month_overrides
  FOR DELETE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit)$'
    ))
    AND hr.can_access_employee(employee_id, 'hr_attendance')
  );

-- Shifts are global reference data; they are permission-protected but are not
-- tied to an individual employee archive.
CREATE POLICY hr_attendance_shifts_select ON hr.attendance_shifts
  FOR SELECT TO web_user
  USING (
    public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code = 'module:hr'
         OR permission.permission_code LIKE 'app:hr_%'
         OR permission.permission_code ~ '^op:hr_.*[.]view$'
    )
  );
CREATE POLICY hr_attendance_shifts_insert ON hr.attendance_shifts
  FOR INSERT TO web_user
  WITH CHECK (
    public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit|shift_create|shift_manage)$'
    )
  );
CREATE POLICY hr_attendance_shifts_update ON hr.attendance_shifts
  FOR UPDATE TO web_user
  USING (
    public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit|shift_create|shift_manage)$'
    )
  )
  WITH CHECK (
    public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_.*[.](create|edit|shift_create|shift_manage)$'
    )
  );
CREATE POLICY hr_attendance_shifts_delete ON hr.attendance_shifts
  FOR DELETE TO web_user
  USING (
    public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    )
  );

-- Salary visibility always requires the dedicated payroll permission (or the
-- existing administrator/HR-admin role) in addition to employee row scope.
DROP POLICY IF EXISTS hr_payroll_select ON hr.payroll;
DROP POLICY IF EXISTS hr_payroll_insert ON hr.payroll;
DROP POLICY IF EXISTS hr_payroll_update ON hr.payroll;
DROP POLICY IF EXISTS hr_payroll_delete ON hr.payroll;

CREATE POLICY hr_payroll_select ON hr.payroll
  FOR SELECT TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR public.document_current_has_permission('op:hr_payroll.view'))
    AND hr.can_access_employee(archive_id, 'hr_payroll')
  );
CREATE POLICY hr_payroll_insert ON hr.payroll
  FOR INSERT TO web_user
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_payroll[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_payroll')
  );
CREATE POLICY hr_payroll_update ON hr.payroll
  FOR UPDATE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_payroll[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_payroll')
  )
  WITH CHECK (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_payroll[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_payroll')
  );
CREATE POLICY hr_payroll_delete ON hr.payroll
  FOR DELETE TO web_user
  USING (
    (public.document_current_is_admin() OR EXISTS (
      SELECT 1 FROM public.document_current_role_codes() role_code
      WHERE lower(role_code.role_code) = 'hr_admin'
    ) OR EXISTS (
      SELECT 1 FROM public.document_current_permissions() permission
      WHERE permission.permission_code ~ '^op:hr_payroll[.](create|edit)$'
    ))
    AND hr.can_access_employee(archive_id, 'hr_payroll')
  );

ALTER FUNCTION hr.current_user_id() OWNER TO eiscore_owner;
ALTER FUNCTION hr.current_employee_archive_id() OWNER TO eiscore_owner;
ALTER FUNCTION hr.can_access_employee(bigint, text) OWNER TO eiscore_owner;
ALTER FUNCTION hr.can_manage_employee_links() OWNER TO eiscore_owner;
ALTER FUNCTION hr.set_user_employee_link_audit() OWNER TO eiscore_owner;
ALTER TABLE hr.user_employee_links OWNER TO eiscore_owner;

REVOKE ALL ON TABLE hr.user_employee_links FROM PUBLIC, web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hr.user_employee_links TO web_user;
GRANT SELECT, INSERT, UPDATE ON TABLE hr.user_employee_links TO eiscore_agent;

REVOKE ALL ON FUNCTION hr.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION hr.current_employee_archive_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION hr.can_access_employee(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hr.can_manage_employee_links() FROM PUBLIC;
REVOKE ALL ON FUNCTION hr.set_user_employee_link_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hr.current_user_id() TO web_user;
GRANT EXECUTE ON FUNCTION hr.current_employee_archive_id() TO web_user;
GRANT EXECUTE ON FUNCTION hr.can_access_employee(bigint, text) TO web_user;
GRANT EXECUTE ON FUNCTION hr.can_manage_employee_links() TO web_user;

COMMENT ON SCHEMA hr IS
  'HR data with stable user-to-archive identity and self/dept/dept_tree/all row scope; payroll additionally requires explicit salary authorization';
