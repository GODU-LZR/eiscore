// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(root, 'eiscore-hr/src/views/HrAclView.vue'), 'utf8')

const activeTabWatcher = source.match(/watch\(activeTab, async \(\) => \{([\s\S]*?)\r?\n\}\)\r?\n\r?\nwatch\(currentRoleId/)
assert.ok(activeTabWatcher, 'ACL active-tab watcher must remain present')
assert.match(activeTabWatcher[1], /if \(activeTab\.value === 'scope'\) \{[\s\S]*?await loadDepartments\(\)[\s\S]*?scopeGridRef\.value\?\.loadData\?\.\(\)/,
  'entering the scope tab must reload departments and the role scope matrix')

const roleWatcher = source.match(/watch\(currentRoleId, \(\) => \{([\s\S]*?)\r?\n\}\)/)
assert.ok(roleWatcher, 'ACL role watcher must remain present')
assert.match(roleWatcher[1], /scopeGridRef\.value\?\.loadData/,
  'changing the selected role must reload the role scope matrix')

console.log('PASS: ACL scope grid reloads after role and tab initialization')
