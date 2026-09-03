#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

set -Eeuo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGRST_JWT_SECRET:?PGRST_JWT_SECRET is required}"

if (( ${#PGRST_JWT_SECRET} < 32 )); then
  echo "database JWT signing secret must contain at least 32 characters" >&2
  return 1 2>/dev/null || exit 1
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv jwt_secret PGRST_JWT_SECRET
SELECT format(
  'ALTER DATABASE %I SET app.jwt_secret TO %L',
  current_database(),
  :'jwt_secret'
) \gexec
SQL

unset PGRST_JWT_SECRET
