-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- DB2 bootstrap roles. Object grants are applied by core-002 after restore.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eiscore_owner') THEN
    CREATE ROLE eiscore_owner NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eiscore_migrator') THEN
    CREATE ROLE eiscore_migrator NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eiscore_authenticator') THEN
    CREATE ROLE eiscore_authenticator NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eiscore_agent') THEN
    CREATE ROLE eiscore_agent NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_user') THEN
    CREATE ROLE web_user NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;

  ALTER ROLE eiscore_owner NOLOGIN NOINHERIT NOBYPASSRLS;
  ALTER ROLE eiscore_migrator NOLOGIN NOINHERIT NOBYPASSRLS;
  ALTER ROLE eiscore_authenticator NOINHERIT NOBYPASSRLS;
  ALTER ROLE eiscore_agent NOINHERIT NOBYPASSRLS;
  ALTER ROLE web_anon NOLOGIN NOINHERIT NOBYPASSRLS;
  ALTER ROLE web_user NOLOGIN NOINHERIT NOBYPASSRLS;

  GRANT eiscore_owner TO eiscore_migrator;
  GRANT web_anon TO eiscore_authenticator;
  GRANT web_user TO eiscore_authenticator;
END
$$;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT USAGE ON SCHEMA public TO web_user;
