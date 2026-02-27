#!/bin/bash
# Quick enterprise assistant test - save raw SSE chunks
cd /home/lzr/eiscore
TOKEN=$(node scripts/gen-test-token.js 2>/dev/null)
echo "Token obtained (${#TOKEN} chars)"

timeout 60 curl -s --no-buffer \
  -X POST http://localhost:8078/agent/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stream":true,"assistant_mode":"enterprise","messages":[{"role":"user","content":"简述仓库和库存概况"}]}' \
  > /tmp/sse-raw.txt 2>&1

echo "Raw SSE saved to /tmp/sse-raw.txt"
echo "Lines: $(wc -l < /tmp/sse-raw.txt)"

# Extract final content (not reasoning_content)
echo ""
echo "=== AI Response Content ==="
grep -oP '"content":"[^"]*"' /tmp/sse-raw.txt | sed 's/"content":"//;s/"$//' | tr -d '\n'
echo ""
echo ""
echo "=== DONE ==="
