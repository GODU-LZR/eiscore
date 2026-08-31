// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const apps = ['apps', 'hr', 'materials', 'sales', 'purchase', 'production', 'quality', 'equipment']
const geoServiceSource = readFileSync(resolve(repoRoot, 'shared/eis-geo-services.js'), 'utf8')
const sharedGeoSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/components/GeoDialog.vue'),
  'utf8'
)
const sharedGridSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridCore.js'),
  'utf8'
)

assert.match(sharedGridSource, /import\s*{\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(sharedGridSource, /localStorage\.getItem\(\s*['"]user_info['"]\s*\)/)
assert.match(sharedGridSource, /const getUserInfoSnapshot = \(\) =>\s*{/)
assert.match(sharedGridSource, /const info = userStore\.userInfo/)
assert.match(sharedGridSource, /Object\.keys\(info\)\.length > 0\) return info/)
assert.match(sharedGridSource, /try\s*{\s*return getUserInfo\(\) \|\| {}\s*}\s*catch/)
assert.match(sharedGridSource, /const perms = info\?\.permissions/)
assert.match(sharedGridSource, /info\?\.app_role \|\| info\?\.appRole \|\| info\?\.role \|\| ['"]/)

for (const app of apps) {
  const componentRoot = resolve(repoRoot, `eiscore-${app}/src/components/eis-data-grid-v2`)
  const gridEntrySource = readFileSync(resolve(componentRoot, 'index.vue'), 'utf8')
  const geoSource = app === 'apps'
    ? readFileSync(resolve(componentRoot, 'components/GeoDialog.vue'), 'utf8')
    : sharedGeoSource

  assert.match(
    gridEntrySource,
    /import SharedGrid from ['"]@shared\/eis-data-grid-v2\/index\.vue['"]/
  )
  assert.doesNotMatch(gridEntrySource, /localStorage\.getItem\(\s*['"]user_info['"]\s*\)/)

  assert.match(geoSource, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
  assert.match(geoSource, /import\s*{\s*createGeoServices,\s*hasChinese\s*}\s*from\s*['"]@shared\/eis-geo-services['"]/)
  assert.doesNotMatch(geoSource, /localStorage\.getItem\(\s*['"]auth_token['"]\s*\)|const getAuthToken/)
  assert.match(geoSource, /createGeoServices\(\{\s*getConfig:\s*getGeoConfig,\s*getToken\s*\}\)/)
  assert.doesNotMatch(geoSource, /buildAuthHeaders|translateWithGlm|\bfetch\s*\(/)
}

assert.doesNotMatch(geoServiceSource, /localStorage|auth_token|user_info/)
assert.match(geoServiceSource, /const buildAuthHeaders = \(\) =>\s*{/)
assert.match(geoServiceSource, /const headers = { ['"]Content-Type['"]: ['"]application\/json['"] }/)
assert.match(geoServiceSource, /const token = getToken\(\)/)
assert.match(geoServiceSource, /if \(token\) headers\.Authorization = `Bearer \$\{token}`/)
assert.match(geoServiceSource, /const translateWithGlm = async \(text\) =>/)

console.log(`PASS: shared Grid and Geo consumers use platform session (${apps.length} applications)`)
