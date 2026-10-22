// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const nginx = readFileSync(new URL('../../deploy/yayu/nginx.conf', import.meta.url), 'utf8')
const compose = readFileSync(new URL('../../deploy/yayu/compose.yml', import.meta.url), 'utf8')
const salesGrid = readFileSync(new URL('../../eiscore-sales/src/components/SalesAppGrid.vue', import.meta.url), 'utf8')

assert.doesNotMatch(nginx, /location ~ \^\/\(company-site\|materials\|purchase\|apps\|/)
assert.match(nginx, /location = \/apps\/index\.html \{ try_files \$uri =404; \}/)
assert.match(nginx, /location \^~ \/apps\/ \{ try_files \$uri \$uri\/ \/apps\/index\.html; \}/)
assert.match(nginx, /location \^~ \/flash\/ \{\s+proxy_pass http:\/\/flash-agent-runtime:8078;/)
assert.match(nginx, /location \^~ \/flash-agent\/ \{\s+proxy_pass http:\/\/flash-agent-runtime:8078\//)
assert.match(compose, /- flash_drafts:\/workspace\/eiscore-apps\/src\/views\/drafts/)
assert.match(compose, /^  flash_drafts:$/m)
assert.equal((compose.match(/image: \$\{YAYU_RUNTIME_IMAGE:\?YAYU_RUNTIME_IMAGE is required\}/g) || []).length, 2)
assert.match(compose, /EISCORE_SOURCE_REVISION: \$\{EISCORE_SOURCE_REVISION:\?EISCORE_SOURCE_REVISION is required\}/)
assert.match(compose, /- \$\{YAYU_SOURCE_ROOT:-\.\/source\}:\/workspace/)
const flashWeb = compose.split('  deepseek-flash-web:')[1].split('  flash-harness-bridge:')[0]
assert.match(flashWeb, /EISCORE_AUTH_GATEWAY_URL: https:\/\/yayu\.eiscore\.top/)
assert.match(flashWeb, /networks: \[flash\]/)
assert.doesNotMatch(flashWeb, /networks:.*business/)
assert.match(salesGrid, /features\?\.purchaseVisible !== false/)
assert.match(salesGrid, /const salesShippingEnabled = enterpriseConfig\.features\?\.salesShipping !== false/)
assert.match(nginx, /company-site\|materials\|purchase\|production/)
assert.doesNotMatch(nginx, /location = \/materials\//)

console.log('PASS: Yayu app and Flash runtime routes')
