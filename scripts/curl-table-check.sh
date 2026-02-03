#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"
USERNAME="admin"
PASSWORD="123456"

TOKEN=$(curl -s -X POST "$BASE_URL/rpc/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  | python3 -c 'import sys, json; print(json.load(sys.stdin).get("token", ""))')

if [ -z "$TOKEN" ]; then
  echo "登录失败，未获取到 token"
  exit 1
fi

echo "TOKEN_LEN=${#TOKEN}"

echo "roles:" $(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Profile: public" \
  "$BASE_URL/roles?code=eq.super_admin")

echo "system_configs(app_settings):" $(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Profile: public" \
  "$BASE_URL/system_configs?key=eq.app_settings")

echo "system_configs(hr_table_cols):" $(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Profile: public" \
  "$BASE_URL/system_configs?key=eq.hr_table_cols")

echo "hr.archives:" $(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Profile: hr" \
  "$BASE_URL/archives?order=id.desc&limit=1")

echo "raw_materials:" $(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Profile: public" \
  "$BASE_URL/raw_materials?order=id.desc&limit=1")
