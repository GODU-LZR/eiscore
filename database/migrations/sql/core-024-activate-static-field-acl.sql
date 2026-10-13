-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Activate the existing field catalog for built-in applications. The ACL
-- lifecycle keeps newly discovered fields in `created` until an operator
-- approves them; this one-time repair only fixes the rows shipped with the
-- static application catalog.

UPDATE public.sys_field_acl AS acl
   SET status = 'active',
       updated_at = clock_timestamp()
  FROM public.roles AS role
 WHERE acl.role_id = role.id
   AND acl.source_app_id IS NULL
   AND acl.status = 'created'
   AND acl.can_view IS TRUE
   AND role.status IN ('active', 'locked');
