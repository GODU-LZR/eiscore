#!/bin/bash
FILE=/tmp/sse-raw.txt

echo "=== Lines with 'content' but NOT 'reasoning_content' ==="
grep 'content' "$FILE" | grep -v reasoning_content | head -30
echo ""
echo "=== Last 20 lines of file ==="
tail -20 "$FILE"
echo ""
echo "=== Total lines ==="
wc -l "$FILE"
