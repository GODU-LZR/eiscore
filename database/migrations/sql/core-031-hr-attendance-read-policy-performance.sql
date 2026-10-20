-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Evaluate request-wide attendance permissions once, before checking each row.
-- can_access_employee(NULL, module) is true only for administrators or an
-- active all scope; those same branches allow every employee in that module.
-- Keep the module permission gate and the original employee check otherwise.
-- ALTER USING preserves each policy's roles, command and permissive setting.

ALTER POLICY hr_attendance_records_select ON hr.attendance_records
USING (
  (SELECT public.document_current_is_admin() OR EXISTS (
    SELECT 1
    FROM public.document_current_permissions() permission
    WHERE permission.permission_code = 'module:hr'
       OR permission.permission_code LIKE 'app:hr_%'
       OR permission.permission_code ~ '^op:hr_.*[.]view$'
  ))
  AND CASE
    WHEN (SELECT hr.can_access_employee(NULL::bigint, 'hr_attendance'))
      THEN true
    ELSE hr.can_access_employee(employee_id, 'hr_attendance')
  END
);

ALTER POLICY hr_attendance_month_overrides_select ON hr.attendance_month_overrides
USING (
  (SELECT public.document_current_is_admin() OR EXISTS (
    SELECT 1
    FROM public.document_current_permissions() permission
    WHERE permission.permission_code = 'module:hr'
       OR permission.permission_code LIKE 'app:hr_%'
       OR permission.permission_code ~ '^op:hr_.*[.]view$'
  ))
  AND CASE
    WHEN (SELECT hr.can_access_employee(NULL::bigint, 'hr_attendance'))
      THEN true
    ELSE hr.can_access_employee(employee_id, 'hr_attendance')
  END
);
