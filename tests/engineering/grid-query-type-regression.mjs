// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const apps = [
  'eiscore-apps',
  'eiscore-equipment',
  'eiscore-hr',
  'eiscore-materials',
  'eiscore-production',
  'eiscore-purchase',
  'eiscore-quality',
  'eiscore-sales'
]

for (const app of apps) {
  const file = resolve(app, 'src/utils/grid-query.js')
  await access(file)
  const { buildSearchQuery } = await import(`${pathToFileURL(file).href}?regression=${app}`)
  const roleFields = [
    { prop: 'name', type: 'text' },
    { prop: 'description', type: 'text' },
    { prop: 'sort' }
  ]

  const textQuery = buildSearchQuery('研发', roleFields)
  assert.ok(textQuery.includes('name.ilike.*%E7%A0%94%E5%8F%91*'), `${app}: text fields should remain searchable`)
  assert.doesNotMatch(textQuery, /sort\.ilike/, `${app}: integer sort must not use ilike`)

  const numericQuery = buildSearchQuery('100', roleFields)
  assert.match(numericQuery, /sort\.eq\.100/, `${app}: numeric sort search should use eq`)
}

console.log('PASS: grid query numeric type regression')
