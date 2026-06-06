#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

# Test verifying a JWT token inside the Docker container

cd /home/lzr/eiscore
TOKEN=$(node scripts/gen-test-token.js 2>/dev/null)
echo "Token: ${TOKEN:0:40}..."

# Verify inside Docker container
docker exec eiscore-agent-runtime node -e "
const jwt = require('jsonwebtoken');
const token = '$TOKEN';
const secret = process.env.PGRST_JWT_SECRET;
console.log('Secret:', secret ? secret.substring(0,10)+'...' : 'MISSING');
try {
  const p = jwt.verify(token, secret);
  console.log('OK:', JSON.stringify(p));
} catch(e) {
  console.log('FAIL:', e.message);
}
"
