-- 00_init_roles.sql
-- 只负责创建角色，确保后续脚本能正常授权
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_user') THEN
    CREATE ROLE web_user NOLOGIN;
  END IF;
END
$$;

-- 基础授权
GRANT USAGE ON SCHEMA public TO web_anon;
GRANT USAGE ON SCHEMA public TO web_user;
