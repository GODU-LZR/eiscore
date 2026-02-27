#!/usr/bin/env bash

set -euo pipefail

DB_CONTAINER="eiscore-db"
DB_NAME="eiscore"
DB_USER="postgres"
OUT_DIR="backups/ontology"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--db-container)
      DB_CONTAINER="$2"
      shift 2
      ;;
    -d|--db-name)
      DB_NAME="$2"
      shift 2
      ;;
    -u|--db-user)
      DB_USER="$2"
      shift 2
      ;;
    -o|--out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${REPO_ROOT}/${OUT_DIR}"
mkdir -p "${TARGET_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${DB_CONTAINER}"; then
  echo "DB container is not running: ${DB_CONTAINER}" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BASE="${TARGET_DIR}/ontology_backup_${TS}"
META_FILE="${BASE}.meta.txt"
SEM_FILE="${BASE}.ontology_table_semantics.csv"
REL_FILE="${BASE}.ontology_table_relations.csv"

echo "Creating ontology backup at ${BASE}..."

docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc \
  "select 'backup_at='||now()||E'\n'||
          'client_encoding='||(select setting from pg_settings where name='client_encoding')||E'\n'||
          'semantics_count='||(select count(*) from public.ontology_table_semantics)||E'\n'||
          'relations_count='||(select count(*) from app_data.ontology_table_relations);" \
  > "${META_FILE}"

docker exec "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" -c \
  "COPY (SELECT * FROM public.ontology_table_semantics ORDER BY table_schema, table_name) TO STDOUT WITH CSV HEADER" \
  > "${SEM_FILE}"

docker exec "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" -c \
  "COPY (SELECT * FROM app_data.ontology_table_relations ORDER BY id) TO STDOUT WITH CSV HEADER" \
  > "${REL_FILE}"

echo "Backup completed:"
echo "  ${META_FILE}"
echo "  ${SEM_FILE}"
echo "  ${REL_FILE}"

