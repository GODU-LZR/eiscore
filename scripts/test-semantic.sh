#!/bin/bash
# Test semantic context injection
cd /home/lzr/eiscore
TOKEN=$(node scripts/gen-test-token.js 2>/dev/null)
echo "Token: ${#TOKEN} chars"

# Send a short request
timeout 30 curl -s --no-buffer \
  -X POST http://localhost:8078/agent/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stream":true,"assistant_mode":"enterprise","messages":[{"role":"user","content":"系统都有哪些数据表，简述其作用"}]}' \
  > /tmp/semantic-test.txt 2>&1

echo "Lines: $(wc -l < /tmp/semantic-test.txt)"
echo "Size: $(wc -c < /tmp/semantic-test.txt)"
