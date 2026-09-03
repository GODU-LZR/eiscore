#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

set -Eeuo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGRST_JWT_SECRET:?PGRST_JWT_SECRET is required}"
: "${POSTGREST_DB_PASSWORD:?POSTGREST_DB_PASSWORD is required}"
: "${AGENT_DB_PASSWORD:?AGENT_DB_PASSWORD is required}"

validate_secret() {
  local name="$1"
  local value="$2"
  local minimum="$3"
  if (( ${#value} < minimum )); then
    echo "$name must contain at least $minimum characters" >&2
    return 1
  fi
  if [[ ! "$value" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "$name must use Base64URL characters only" >&2
    return 1
  fi
  case "$value" in
    postgres|postgres123|replace_me*|change_me*)
      echo "$name contains a known weak or placeholder value" >&2
      return 1
      ;;
  esac
}

validate_secret PGRST_JWT_SECRET "$PGRST_JWT_SECRET" 32
validate_secret POSTGREST_DB_PASSWORD "$POSTGREST_DB_PASSWORD" 24
validate_secret AGENT_DB_PASSWORD "$AGENT_DB_PASSWORD" 24
if [[ "$POSTGREST_DB_PASSWORD" == "$AGENT_DB_PASSWORD" ]]; then
  echo "POSTGREST_DB_PASSWORD and AGENT_DB_PASSWORD must be independent secrets" >&2
  return 1 2>/dev/null || exit 1
fi
if [[ "${POSTGRES_PASSWORD:-}" == "$POSTGREST_DB_PASSWORD" || "${POSTGRES_PASSWORD:-}" == "$AGENT_DB_PASSWORD" ]]; then
  echo "service-role passwords must not reuse POSTGRES_PASSWORD" >&2
  return 1 2>/dev/null || exit 1
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv jwt_secret PGRST_JWT_SECRET
SELECT format(
  'ALTER DATABASE %I SET app.jwt_secret TO %L',
  current_database(),
  :'jwt_secret'
) \gexec

\getenv postgrest_password POSTGREST_DB_PASSWORD
\getenv agent_password AGENT_DB_PASSWORD
ALTER ROLE eiscore_authenticator LOGIN PASSWORD :'postgrest_password';
ALTER ROLE eiscore_agent LOGIN PASSWORD :'agent_password';
ALTER ROLE eiscore_owner NOLOGIN;
ALTER ROLE eiscore_migrator NOLOGIN;
ALTER ROLE web_anon NOLOGIN;
ALTER ROLE web_user NOLOGIN;
SQL

unset PGRST_JWT_SECRET POSTGREST_DB_PASSWORD AGENT_DB_PASSWORD
