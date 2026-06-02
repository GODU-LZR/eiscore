#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

# Extract content from SSE raw file
FILE=/tmp/sse-raw.txt

echo "=== AI Reasoning (first 800 chars) ==="
grep -oP 'reasoning_content":"[^"]*' "$FILE" | sed 's/reasoning_content":"//g' | tr -d '\n' | head -c 800
echo ""
echo ""

echo "=== AI Final Content ==="
grep -oP '"content":"[^"]*' "$FILE" | sed 's/"content":"//g' | tr -d '\n'
echo ""
echo ""
echo "=== DONE ==="
