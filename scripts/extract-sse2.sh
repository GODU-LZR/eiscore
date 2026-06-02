#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

FILE=/tmp/sse-raw.txt

echo "=== Lines with 'content' but NOT 'reasoning_content' ==="
grep 'content' "$FILE" | grep -v reasoning_content | head -30
echo ""
echo "=== Last 20 lines of file ==="
tail -20 "$FILE"
echo ""
echo "=== Total lines ==="
wc -l "$FILE"
