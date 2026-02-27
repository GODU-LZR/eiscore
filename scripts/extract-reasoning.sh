#!/bin/bash
FILE=/tmp/sse-raw.txt

echo "=== Full AI Reasoning Content ==="
grep -oP 'reasoning_content":"[^"]*' "$FILE" | sed 's/reasoning_content":"//g' | tr -d '\n' | sed 's/\\n/\n/g'
echo ""
echo "=== DONE ==="
