// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const gridSource = readFileSync(resolve(repoRoot, 'shared/eis-data-grid-v2/index.vue'), 'utf8')
const lockHeaderSource = readFileSync(resolve(repoRoot, 'shared/eis-data-grid-v2/components/renderers/LockHeader.vue'), 'utf8')

assert.match(gridSource, /wrapHeaderText:\s*false/)
assert.match(gridSource, /autoHeaderHeight:\s*false/)
assert.match(gridSource, /\.custom-header-label[^}]*text-overflow:\s*clip[^}]*white-space:\s*nowrap/)
assert.match(gridSource, /\.ag-header-cell-text[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*clip/)
assert.match(gridSource, /overflow:\s*visible\s*!important/)
assert.doesNotMatch(gridSource, /\.custom-header-label[^}]*white-space:\s*normal/)
assert.doesNotMatch(gridSource, /\.ag-header-cell-text[^}]*white-space:\s*normal/)
assert.doesNotMatch(gridSource, /\.ag-header-cell-text[^}]*word-break:\s*break-all/)
assert.match(lockHeaderSource, /\.custom-header-label[^}]*text-overflow:\s*clip[^}]*white-space:\s*nowrap/)
assert.doesNotMatch(lockHeaderSource, /\.custom-header-label[^}]*white-space:\s*normal/)
assert.doesNotMatch(lockHeaderSource, /\.custom-header-label[^}]*word-break:\s*break-all/)

const gridCoreSource = readFileSync(resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridCore.js'), 'utf8')
assert.match(gridCoreSource, /const getHeaderMinWidth = \(label\)/)
assert.match(gridCoreSource, /Math\.max\(Number\(col\.minWidth\) \|\| 0, getHeaderMinWidth\(col\.label\), 150\)/)

console.log('PASS: shared AG Grid headers stay single-line and fully visible')
