-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

CREATE SCHEMA IF NOT EXISTS eiscore_meta;

CREATE TABLE IF NOT EXISTS eiscore_meta.database_releases (
  release_id text PRIMARY KEY,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_revision text NOT NULL CHECK (source_revision ~ '^[0-9a-f]{40}$'),
  database_catalog_sha256 text NOT NULL CHECK (database_catalog_sha256 ~ '^[0-9a-f]{64}$'),
  postgrest_openapi_sha256 text NOT NULL CHECK (postgrest_openapi_sha256 ~ '^[0-9a-f]{64}$'),
  backup_evidence jsonb NOT NULL,
  applied_by text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (manifest_sha256)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_owner') THEN
    ALTER TABLE eiscore_meta.database_releases OWNER TO eiscore_owner;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA eiscore_meta FROM PUBLIC;
REVOKE ALL ON TABLE eiscore_meta.database_releases FROM PUBLIC;
