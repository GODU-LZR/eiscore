#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PGRST_JWT_SECRET:-}" ]]; then
  echo "PGRST_JWT_SECRET is required for database login signing" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  -v jwt_secret="$PGRST_JWT_SECRET" \
  -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-eiscore}" \
  -f /docker-entrypoint-initdb.d/98_patch_login_jwt_secret_setting.sql
