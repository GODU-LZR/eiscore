#!/bin/bash
# Test enterprise assistant snapshot data injection
set -e

BASE_URL="http://localhost:8078"

# Step 1: Generate JWT token
echo "=== Step 1: Generate JWT ==="
TOKEN=$(cd /home/lzr/eiscore && node scripts/gen-test-token.js)
echo "Token obtained: ${TOKEN:0:40}..."
echo "Token length: ${#TOKEN}"

# Step 2: Quick auth test
echo ""
echo "=== Step 2: Auth test ==="
AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/agent/ai/config" -H "Authorization: Bearer $TOKEN")
echo "Auth test status: $AUTH_TEST"

# Step 3: Send enterprise assistant request (non-streaming)
echo ""
echo "=== Step 3: Enterprise assistant request ==="
RESP=$(curl -s -w "\n---HTTP_CODE:%{http_code}" -X POST "$BASE_URL/agent/ai/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stream":false,"assistant_mode":"enterprise","messages":[{"role":"user","content":"请简要概述当前企业经营数据"}]}')

echo "Response (first 2000 chars):"
echo "$RESP" | head -c 2000
echo ""

# Step 4: Check logs for snapshot
echo ""
echo "=== Step 4: Docker logs ==="
docker logs eiscore-agent-runtime --tail 20 2>&1 | grep -E "biz-snapshot|enterprise|snapshot" || echo "(no snapshot keywords found)"
