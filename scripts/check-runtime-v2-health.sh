#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

set -euo pipefail

DB_CONTAINER="${EISCORE_DB_CONTAINER:-eiscore-db}"
DB_NAME="${EISCORE_DB_NAME:-eiscore}"
DB_USER="${EISCORE_DB_USER:-postgres}"
AGENT_HEALTH_URL="${EISCORE_AGENT_HEALTH_URL:-http://127.0.0.1:8078/health}"
POSTGREST_URL="${EISCORE_POSTGREST_URL:-http://127.0.0.1:3000/}"
START_SERVICES="false"
SKIP_POSTCHECK="false"
SKIP_ACCESS_SMOKE="false"
TIMEOUT_SECONDS=90

usage() {
  cat <<'EOF'
Usage: scripts/check-runtime-v2-health.sh [options]

Options:
  --start              Start local Runtime V2 docker compose services before checking.
  --skip-postcheck     Skip sql/runtime_v2_postcheck.sql validation.
  --skip-access-smoke  Skip PostgREST agent ontology access-control smoke test.
  --timeout <seconds>  Readiness wait timeout. Default: 90.
  --db-container <n>   Database container name. Default: eiscore-db.
  --db-name <n>        Database name. Default: eiscore.
  --db-user <n>        Database user. Default: postgres.
  --agent-health <url> Agent runtime health URL. Default: http://127.0.0.1:8078/health.
  --postgrest <url>    PostgREST root URL. Default: http://127.0.0.1:3000/.
  -h, --help           Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start)
      START_SERVICES="true"
      shift 1
      ;;
    --skip-postcheck)
      SKIP_POSTCHECK="true"
      shift 1
      ;;
    --skip-access-smoke)
      SKIP_ACCESS_SMOKE="true"
      shift 1
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    --db-container)
      DB_CONTAINER="$2"
      shift 2
      ;;
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --db-user)
      DB_USER="$2"
      shift 2
      ;;
    --agent-health)
      AGENT_HEALTH_URL="$2"
      shift 2
      ;;
    --postgrest)
      POSTGREST_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIAGNOSTIC_CONTAINERS=(
  "${DB_CONTAINER}"
  "eiscore-api"
  "eiscore-agent-runtime"
  "eiscore-nginx"
  "eiscore-swagger"
  "eiscore-ide"
)

print_container_diagnostics() {
  echo "Container states:" >&2
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' >&2 || true

  for container in "${DIAGNOSTIC_CONTAINERS[@]}"; do
    if ! docker ps -a --format '{{.Names}}' | grep -qx "${container}"; then
      continue
    fi

    echo >&2
    echo "[${container}] inspect:" >&2
    docker inspect "${container}" \
      --format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} started={{.State.StartedAt}} finished={{.State.FinishedAt}} error={{.State.Error}}' >&2 || true

    echo "[${container}] recent logs:" >&2
    docker logs --tail 80 "${container}" >&2 || true

    echo "[${container}] recent events:" >&2
    docker events --since 10m --until 0s --filter "container=${container}" \
      --format '{{.Time}} {{.Action}} exit={{.Actor.Attributes.exitCode}} signal={{.Actor.Attributes.signal}}' \
      | tail -n 20 >&2 || true
  done
}

fail() {
  echo "ERROR: $*" >&2
  echo >&2
  print_container_diagnostics
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

wait_until() {
  local description="$1"
  shift
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    if "$@" >/dev/null 2>&1; then
      echo "OK: ${description}"
      return 0
    fi
    sleep 1
  done
  return 1
}

container_running() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

http_ok() {
  curl -fsS --max-time 5 "$1" >/dev/null
}

require_command docker
require_command curl
require_command node

if [[ "${START_SERVICES}" == "true" ]]; then
  echo "Starting Runtime V2 docker compose services from ${REPO_ROOT}..."
  (
    cd "${REPO_ROOT}"
    docker compose up -d db api agent-runtime nginx swagger code-server
  )
fi

required_containers=(
  "${DB_CONTAINER}"
  "eiscore-api"
  "eiscore-agent-runtime"
  "eiscore-nginx"
  "eiscore-swagger"
  "eiscore-ide"
)

for container in "${required_containers[@]}"; do
  if [[ "${START_SERVICES}" != "true" ]] && ! container_running "${container}"; then
    fail "container is not running: ${container}. Try: npm run runtime:up"
  fi
  wait_until "container ${container} is running" container_running "${container}" \
    || fail "container is not running: ${container}. Try: npm run runtime:up"
done

wait_until "database ${DB_CONTAINER}/${DB_NAME} is ready" \
  docker exec "${DB_CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" \
  || fail "database is not ready: ${DB_CONTAINER}/${DB_NAME}"

wait_until "PostgREST responds at ${POSTGREST_URL}" http_ok "${POSTGREST_URL}" \
  || fail "PostgREST did not become ready: ${POSTGREST_URL}"

wait_until "agent runtime responds at ${AGENT_HEALTH_URL}" http_ok "${AGENT_HEALTH_URL}" \
  || fail "agent runtime did not become ready: ${AGENT_HEALTH_URL}"

if [[ "${SKIP_POSTCHECK}" != "true" ]]; then
  echo "Running Runtime V2 database postcheck..."
  (
    cd "${REPO_ROOT}"
    node tests/engineering/runtime-v2-postcheck.mjs
  )
fi

if [[ "${SKIP_ACCESS_SMOKE}" != "true" ]]; then
  echo "Running Runtime V2 PostgREST access-control smoke..."
  (
    cd "${REPO_ROOT}"
    node tests/engineering/runtime-v2-access-smoke.mjs
  )
fi

echo
echo "Runtime V2 local health check passed."
