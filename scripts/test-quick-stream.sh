#!/bin/bash
# Quick stream test for enterprise assistant
cd /home/lzr/eiscore
TOKEN=$(node scripts/gen-test-token.js 2>/dev/null)
echo "Token length: ${#TOKEN}"
echo "Token: $TOKEN"
echo "---"
echo "Testing auth..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8078/agent/ai/config -H "Authorization: Bearer $TOKEN")
echo "Auth test: $HTTP_CODE"
echo "---"
echo "Sending enterprise request (stream)..."
timeout 30 curl -s --no-buffer \
  -X POST http://localhost:8078/agent/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stream":true,"assistant_mode":"enterprise","messages":[{"role":"user","content":"简述仓库和库存概况"}]}' \
  2>&1 | grep -oP '"content":"[^"]*"' | sed 's/"content":"//;s/"$//' | tr -d '\n'
echo ""
echo ""
echo "---DONE---"
