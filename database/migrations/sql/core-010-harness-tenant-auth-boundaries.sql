-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Keep published core-002 and baseline-covered runtime-v2-003 immutable.
-- Apply Harness tenant/auth and ontology boundaries to existing installs here.

-- Harness requests are tenant-scoped.  Preserve the existing single-tenant
-- deployment behaviour with an explicit local/default tenant until a tenant
-- registry is introduced.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE public.users
SET tenant_id = COALESCE(NULLIF(btrim(tenant_id), ''), 'default')
WHERE tenant_id IS NULL OR btrim(tenant_id) = '';
ALTER TABLE public.users
  ALTER COLUMN tenant_id SET DEFAULT 'default',
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.login(username text, password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  _app_role text;
  _permissions text[];
  _user_id integer;
  _tenant_id text;
  token_claims json;
  _secret text := nullif(current_setting('app.jwt_secret', true), '');
BEGIN
  IF _secret IS NULL OR octet_length(_secret) < 32 THEN
    RAISE EXCEPTION 'JWT signing secret is not configured'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT u.id, u.tenant_id
    INTO _user_id, _tenant_id
  FROM public.users u
  WHERE lower(trim(u.username)) = lower(trim(login.username))
    AND u.password = trim(login.password);

  IF _user_id IS NULL THEN
    RAISE invalid_password USING message = '账号或密码错误';
  END IF;

  SELECT array_agg(distinct pcode order by pcode)
    INTO _permissions
  FROM (
    SELECT unnest(v.permissions) AS pcode
    FROM public.user_roles ur
    JOIN public.v_role_permissions v ON v.role_id = ur.role_id
    WHERE ur.user_id = _user_id
  ) perms;

  IF _permissions IS NULL THEN
    SELECT u.permissions INTO _permissions FROM public.users u WHERE u.id = _user_id;
  END IF;

  SELECT v.role_code
    INTO _app_role
  FROM public.user_roles ur
  JOIN public.v_role_permissions v ON v.role_id = ur.role_id
  WHERE ur.user_id = _user_id
  ORDER BY v.role_code ASC
  LIMIT 1;

  IF _app_role IS NULL OR _app_role = '' THEN
    SELECT u.role INTO _app_role FROM public.users u WHERE u.id = _user_id;
  END IF;

  token_claims := json_build_object(
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'tenant_id', _tenant_id,
    'exp', extract(epoch from now() + interval '2 hours')::integer
  );

  RETURN json_build_object(
    'token', public.sign(token_claims, _secret),
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'tenant_id', _tenant_id,
    'permissions', coalesce(_permissions, ARRAY[]::text[])
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.login(text, text) TO web_anon;

CREATE OR REPLACE FUNCTION public.login(payload json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  RETURN public.login(payload->>'username', payload->>'password');
END;
$$;
GRANT EXECUTE ON FUNCTION public.login(json) TO web_anon;

-- RLS policies for user-scoped inventory reads call these stable, read-only
-- identity helpers. Keep execution explicit for the API role; the functions
-- still run as invoker and do not bypass row-level security.
GRANT EXECUTE ON FUNCTION public.current_username() TO web_user;
GRANT EXECUTE ON FUNCTION public.current_user_dept_id() TO web_user;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO web_user;
GRANT EXECUTE ON FUNCTION public.current_scope(text) TO web_user;
GRANT EXECUTE ON FUNCTION public.dept_tree_ids(uuid) TO web_user;

-- Raw ontology tables are implementation details. Expose the tenant-safe
-- agent_* RPC surface instead of allowing direct web_user/PUBLIC reads.
REVOKE ALL ON TABLE
  public.ontology_column_semantics,
  public.ontology_inference_rules,
  public.ontology_inferred_facts,
  public.ontology_reasoning_runs,
  public.ontology_table_semantics
FROM PUBLIC, web_user;
REVOKE EXECUTE ON FUNCTION
  public.search_ontology_kg_nodes(text, text, integer),
  public.query_ontology_kg_neighbors(text, text, text, integer, integer, text),
  public.find_ontology_kg_paths(text, text, text, text, integer, text, integer),
  public.explain_ontology_path(text, text, text, text, integer),
  public.explain_role_ontology_access(text, integer)
FROM PUBLIC, web_user;
REVOKE ALL ON TABLE
  public.v_ontology_kg_nodes,
  public.v_ontology_reasoning_edges,
  public.v_ontology_reasoning_facts,
  public.v_ontology_reasoning_health,
  public.v_ontology_reasoning_rule_stats,
  public.v_ontology_reasoning_summary,
  public.v_ontology_role_access_insights,
  public.v_ontology_sensitive_access_paths,
  public.v_ontology_table_dependency_paths,
  public.v_ontology_table_impact_insights
FROM PUBLIC, web_user;

-- Raw coverage diagnostics must remain behind the scoped health RPC.
REVOKE ALL ON public.v_ontology_coverage_audit FROM PUBLIC, web_user;
