-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Provide an atomic, knowledge-profile-only metadata patch for twin files.

CREATE OR REPLACE FUNCTION public.merge_twin_knowledge_file_metadata(
  p_id uuid,
  p_employee_id text,
  p_harness_namespace text,
  p_metadata_patch jsonb
)
RETURNS TABLE (
  id uuid,
  file_name text,
  file_type text,
  file_size integer,
  tags text[],
  summary text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public, app_data
AS $$
DECLARE
  claims jsonb := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  claim_username text := NULLIF(claims ->> 'username', '');
  claim_namespace text := COALESCE(NULLIF(claims ->> 'harness_namespace', ''), 'business');
BEGIN
  IF p_harness_namespace IS DISTINCT FROM 'knowledge'
     OR claim_namespace IS DISTINCT FROM 'knowledge'
     OR p_employee_id IS DISTINCT FROM claim_username THEN
    RAISE EXCEPTION 'knowledge file metadata scope is required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_id IS NULL
     OR p_metadata_patch IS NULL
     OR jsonb_typeof(p_metadata_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'metadata patch must be a JSON object'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH patch AS (
    SELECT
      COALESCE(
        jsonb_object_agg(entry.key, entry.value)
          FILTER (WHERE jsonb_typeof(entry.value) <> 'null'),
        '{}'::jsonb
      ) AS values_to_merge,
      COALESCE(
        array_agg(entry.key)
          FILTER (WHERE jsonb_typeof(entry.value) = 'null'),
        ARRAY[]::text[]
      ) AS keys_to_remove
    FROM jsonb_each(p_metadata_patch) AS entry(key, value)
  ), updated AS (
    UPDATE app_data.twin_knowledge_files AS file
       SET metadata = (COALESCE(file.metadata, '{}'::jsonb) || patch.values_to_merge) - patch.keys_to_remove,
           updated_at = now()
      FROM patch
     WHERE file.id = p_id
       AND file.employee_id = p_employee_id
       AND file.harness_namespace = p_harness_namespace
    RETURNING file.id, file.file_name, file.file_type, file.file_size,
              file.tags, file.summary, file.metadata, file.created_at, file.updated_at
  )
  SELECT * FROM updated;
END;
$$;

ALTER FUNCTION public.merge_twin_knowledge_file_metadata(uuid, text, text, jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.merge_twin_knowledge_file_metadata(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_twin_knowledge_file_metadata(uuid, text, text, jsonb) TO web_user;
GRANT EXECUTE ON FUNCTION public.merge_twin_knowledge_file_metadata(uuid, text, text, jsonb) TO eiscore_agent;

DO $twin_metadata_merge_contract$
DECLARE
  function_definition text;
  function_owner text;
BEGIN
  SELECT pg_get_functiondef(p.oid), owner_role.rolname
    INTO function_definition, function_owner
  FROM pg_proc AS p
  JOIN pg_roles AS owner_role ON owner_role.oid = p.proowner
  WHERE p.oid = 'public.merge_twin_knowledge_file_metadata(uuid,text,text,jsonb)'::regprocedure;

  IF function_owner IS DISTINCT FROM 'eiscore_owner' THEN
    RAISE EXCEPTION 'merge_twin_knowledge_file_metadata must be owned by eiscore_owner';
  END IF;
  IF function_definition NOT LIKE '%SECURITY INVOKER%' THEN
    RAISE EXCEPTION 'merge_twin_knowledge_file_metadata must preserve RLS through invoker security';
  END IF;
  IF function_definition NOT LIKE '%harness_namespace%'
     OR function_definition NOT LIKE '%employee_id%' THEN
    RAISE EXCEPTION 'merge_twin_knowledge_file_metadata must enforce owner and namespace predicates';
  END IF;
END
$twin_metadata_merge_contract$;

NOTIFY pgrst, 'reload schema';
