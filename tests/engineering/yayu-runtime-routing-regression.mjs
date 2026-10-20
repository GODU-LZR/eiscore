// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const nginx = readFileSync(new URL('../../deploy/yayu/nginx.conf', import.meta.url), 'utf8')
const compose = readFileSync(new URL('../../deploy/yayu/compose.yml', import.meta.url), 'utf8')
const salesGrid = readFileSync(new URL('../../eiscore-sales/src/components/SalesAppGrid.vue', import.meta.url), 'utf8')

assert.doesNotMatch(nginx, /location ~ \^\/\(company-site\|apps\|/)
assert.match(nginx, /location = \/apps\/ \{ try_files \/apps\/index\.html =404; \}/)
assert.match(nginx, /location \^~ \/apps\/ \{ try_files \$uri \$uri\/ \/apps\/index\.html; \}/)
assert.match(nginx, /location \^~ \/flash\/ \{\s+proxy_pass http:\/\/flash-agent-runtime:8078;/)
assert.match(nginx, /location \^~ \/flash-agent\/ \{\s+proxy_pass http:\/\/flash-agent-runtime:8078\//)
assert.match(compose, /- flash_drafts:\/workspace\/eiscore-apps\/src\/views\/drafts/)
assert.match(compose, /^  flash_drafts:$/m)
assert.match(salesGrid, /features\?\.purchaseVisible !== false/)
assert.match(salesGrid, /features\?\.salesShipping !== false/)

console.log('PASS: Yayu app and Flash runtime routes')
