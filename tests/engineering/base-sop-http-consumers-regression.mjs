// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')

const section = (start, end) => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `missing section: ${start}`)
  assert.notEqual(endIndex, -1, `missing section boundary: ${end}`)
  return source.slice(startIndex, endIndex)
}

assert.match(source, /import\s*{\s*getHostHttpClient\s*}\s*from\s*['"]@\/platform\/http-client['"]/)

const loadRecords = section('const fetchSopLearningRecords = async () => {', 'const saveGuideProgress = () => {')
assert.doesNotMatch(loadRecords, /\bfetch\s*\(/)
assert.doesNotMatch(loadRecords, /getAuthHeader|Authorization/)
assert.match(loadRecords, /getHostHttpClient\(\)\.requestJson\(`\/sop_learning_records\?username=eq\.\$\{encodedUsername\}&select=guide_id,seen_at,completed_at,status&limit=500`/)
assert.match(loadRecords, /['"]Accept-Profile['"]:\s*['"]public['"]/)
assert.match(loadRecords, /['"]Content-Profile['"]:\s*['"]public['"]/)
assert.match(loadRecords, /const rows = data/)
assert.match(loadRecords, /guideProgressSyncState\.value = ['"]synced['"]/)
assert.match(loadRecords, /catch \(e\) \{\s*guideProgressSyncState\.value = ['"]local['"]/)

const syncRecord = section('const syncSopLearningRecord = async (guideId) => {', 'const markGuideSeen = (guideId) => {')
assert.doesNotMatch(syncRecord, /\bfetch\s*\(/)
assert.doesNotMatch(syncRecord, /getAuthHeader|Authorization/)
assert.match(syncRecord, /requestJson\(['"]\/sop_learning_records\?on_conflict=username,guide_id['"]/)
assert.match(syncRecord, /method:\s*['"]POST['"]/)
assert.match(syncRecord, /Prefer:\s*['"]resolution=merge-duplicates['"]/)
assert.match(syncRecord, /body:\s*record/)
assert.match(syncRecord, /guideProgressSyncState\.value = ['"]synced['"]/)
assert.match(syncRecord, /catch \(e\) \{\s*guideProgressSyncState\.value = ['"]local['"]/)

console.log('PASS: base SOP learning records use platform HTTP')
