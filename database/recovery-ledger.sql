-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

CREATE SCHEMA IF NOT EXISTS eiscore_meta;

CREATE TABLE IF NOT EXISTS eiscore_meta.database_recoveries (
  recovery_id text PRIMARY KEY,
  release_id text NOT NULL,
  release_manifest_sha256 text NOT NULL CHECK (release_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  backup_evidence_sha256 text NOT NULL CHECK (backup_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  database_dump_sha256 text NOT NULL CHECK (database_dump_sha256 ~ '^[0-9a-f]{64}$'),
  recovered_by text NOT NULL,
  recovery_ms bigint NOT NULL CHECK (recovery_ms >= 0),
  recovered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_owner') THEN
    ALTER TABLE eiscore_meta.database_recoveries OWNER TO eiscore_owner;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA eiscore_meta FROM PUBLIC;
REVOKE ALL ON TABLE eiscore_meta.database_recoveries FROM PUBLIC;
