-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

CREATE SCHEMA IF NOT EXISTS eiscore_meta;

CREATE TABLE IF NOT EXISTS eiscore_meta.schema_migrations (
  migration_id text PRIMARY KEY,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_path text NOT NULL,
  rollback_strategy text NOT NULL,
  release_revision text NOT NULL DEFAULT 'unknown',
  applied_by text NOT NULL DEFAULT current_user,
  execution_ms bigint NOT NULL DEFAULT 0 CHECK (execution_ms >= 0),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON SCHEMA eiscore_meta FROM PUBLIC;
REVOKE ALL ON TABLE eiscore_meta.schema_migrations FROM PUBLIC;
