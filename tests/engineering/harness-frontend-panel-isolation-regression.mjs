// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const businessPatch = read('deploy/lundu/dsh-web.patch.yml')
const flashPatch = read('deploy/lundu/dsh-flash-web.patch.yml')
const nginx = read('deploy/lundu/nginx/lundu-eiscore.conf')
const localNginx = read('nginx/conf.d/default.conf')
const embed = read('eiscore-base/src/views/EmbedView.vue')
const flashBuilder = read('eiscore-apps/src/views/FlashBuilder.vue')

// The business host may expose only the two business panels.
assert.match(businessPatch, /client-plugins\/digital-twin\/lib\/index\.js/)
assert.match(businessPatch, /client-plugins\/enterprise-bi\/lib\/index\.js/)
assert.doesNotMatch(businessPatch, /flash-context|flash-builder/)

// The Flash host is coding-only and must not receive business panel plugins.
assert.match(flashPatch, /client-plugins\/flash-context\/lib\/index\.js/)
assert.doesNotMatch(flashPatch, /digital-twin|enterprise-bi/)

for (const source of [nginx, localNginx]) {
  assert.match(source, /location \/harness-embed\//)
  assert.match(source, /location \/harness-flash-embed\//)
  assert.match(source, /harness-embed.*deepseek-web|proxy_pass http:\/\/deepseek-web:3081\//s)
  assert.match(source, /harness-flash-embed.*deepseek-flash-web|proxy_pass http:\/\/deepseek-flash-web:3081\//s)
  assert.match(source, /harness-embed-plugins.*deepseek-web|proxy_pass http:\/\/deepseek-web:3081\/plugins\//s)
  assert.match(source, /harness-flash-embed-plugins.*deepseek-flash-web|proxy_pass http:\/\/deepseek-flash-web:3081\/plugins\//s)
}

assert.match(embed, /\/harness-embed\//)
assert.match(embed, /digital-twin|smart-bi/)
assert.match(flashBuilder, /const harnessFrameUrl = ['"]\/harness-flash-embed\//)
assert.match(flashBuilder, /authApiPrefix:\s*['"]\/harness-flash-embed-api['"]/) 
assert.doesNotMatch(flashBuilder, /const harnessFrameUrl = ['"]\/harness-embed\//)

console.log('PASS: Harness frontend panel isolation routes and plugin patches')
