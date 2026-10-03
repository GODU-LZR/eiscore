-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Retire the pre-Harness model configuration without changing the shared
-- system-config table used by business modules.  The key is removed from
-- existing databases and excluded by RLS from every PostgREST role that can
-- access the table.  Harness deployment settings stay outside this table.

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_configs_web_anon_select ON public.system_configs;
DROP POLICY IF EXISTS system_configs_web_user_manage ON public.system_configs;

CREATE POLICY system_configs_web_anon_select
  ON public.system_configs
  FOR SELECT TO web_anon
  USING (key <> 'ai_glm_config');

CREATE POLICY system_configs_web_user_manage
  ON public.system_configs
  FOR ALL TO web_user
  USING (key <> 'ai_glm_config')
  WITH CHECK (key <> 'ai_glm_config');

DELETE FROM public.system_configs
WHERE key = 'ai_glm_config';

COMMENT ON TABLE public.system_configs IS
  'Business application settings only; legacy ai_glm_config is retired and Harness deployment settings are external.';
