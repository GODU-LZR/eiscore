// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

const simpleDesigner = read('eiscore-apps/src/views/WorkflowDesigner.vue')
assert.match(simpleDesigner, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(simpleDesigner, directSessionStorage)
assert.equal((simpleDesigner.match(/const token = getToken\(\)/g) || []).length, 4)
assert.match(simpleDesigner, /['"]Accept-Profile['"]: ['"]app_center['"]/)
assert.match(simpleDesigner, /\/api\/workflow_state_mappings/)
assert.match(simpleDesigner, /status: ['"]published['"]/)

const approvalCenter = read('eiscore-apps/src/views/WorkflowApprovalCenter.vue')
assert.match(approvalCenter, /import\s*{\s*getToken,\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(approvalCenter, directSessionStorage)
assert.equal((approvalCenter.match(/const token = getToken\(\)/g) || []).length, 2)
assert.match(approvalCenter, /const info = getUserInfo\(\) \|\| {}/)
assert.match(approvalCenter, /info\?\.app_role \|\| info\?\.appRole \|\| info\?\.role/)
assert.match(approvalCenter, /['"]Accept-Profile['"]: ['"]workflow['"]/)
assert.match(approvalCenter, /['"]Accept-Profile['"]: ['"]public['"]/)
assert.match(approvalCenter, /\/api\/rpc\/reject_workflow_task/)
assert.match(approvalCenter, /\/api\/rpc\/transition_workflow_instance/)

const flowDesigner = read('eiscore-apps/src/views/flow/FlowDesigner.vue')
assert.match(flowDesigner, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(flowDesigner, directSessionStorage)
assert.equal((flowDesigner.match(/const token = getToken\(\)/g) || []).length, 12)
assert.match(flowDesigner, /['"]Accept-Profile['"]: ['"]app_center['"]/)
assert.match(flowDesigner, /['"]Accept-Profile['"]: ['"]workflow['"]/)
assert.match(flowDesigner, /['"]Accept-Profile['"]: ['"]public['"]/)
assert.match(flowDesigner, /\/api\/task_assignments/)
assert.match(flowDesigner, /\/api\/workflow_state_mappings/)
assert.match(flowDesigner, /\/api\/published_routes/)
assert.match(flowDesigner, /status: ['"]published['"]/)

console.log('PASS: workflow consumers use platform session (3 files)')
