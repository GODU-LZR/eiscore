// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  compactBaseGuideSteps,
  normalizeBaseExternalGuide,
  normalizeBaseGuideId,
  normalizeBaseGuideProgress,
  normalizeBaseGuideProgressEntry,
  normalizeBaseGuideText,
  normalizeBaseSopRole,
  parseBaseSopStepTexts,
  pickBaseRecommendedGuide,
  shortenBaseGuideDescription
} from '../../eiscore-base/src/domain/base-layout-guide-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(normalizeBaseSopRole(' Warehouse_Keeper '), 'warehouse')
assert.equal(normalizeBaseSopRole('QC'), 'quality')
assert.equal(normalizeBaseSopRole('Human_Resource'), 'hr_admin')
assert.equal(normalizeBaseSopRole('custom_role'), 'custom_role')
assert.equal(normalizeBaseGuideText('  第一步\n  确认   单据  '), '第一步 确认 单据')
assert.equal(normalizeBaseGuideId(' /Sales/订单 #1 '), 'sales-订单-1')
assert.equal(normalizeBaseGuideId('---'), 'current')

assert.deepEqual(parseBaseSopStepTexts('[" 第一步 ","","第二步"]'), ['第一步', '第二步'])
assert.deepEqual(parseBaseSopStepTexts('第一步 |  第二步||'), ['第一步', '第二步'])
assert.deepEqual(parseBaseSopStepTexts(''), [])

assert.equal(normalizeBaseExternalGuide(null), null)
assert.equal(normalizeBaseExternalGuide({ id: 'x', title: 'X', steps: [] }), null)
assert.deepEqual(normalizeBaseExternalGuide({
  id: ' custom ',
  title: ' 自定义指引 ',
  description: 12,
  type: 'sop',
  category: '扩展',
  routes: [' /sales ', '', null],
  priority: 0,
  steps: [
    { selector: ' [data-guide="grid"] ', title: '', description: '检查表格', side: 'right', align: 'center' },
    { element: '.save-button' },
    { selector: '  ' }
  ]
}), {
  id: 'custom',
  title: '自定义指引',
  description: '12',
  type: 'sop',
  category: '扩展',
  routes: ['/sales'],
  priority: 30,
  steps: [
    {
      element: '[data-guide="grid"]',
      popover: { title: '操作提示', description: '检查表格', side: 'right', align: 'center' }
    },
    {
      element: '.save-button',
      popover: { title: '操作提示', description: '', side: 'bottom', align: 'start' }
    }
  ]
})

const guides = [
  { id: 'base', type: 'guide', category: '基础' },
  { id: 'cards-app-cards', type: 'sop', category: '应用卡片' },
  { id: 'card-one', type: 'guide', category: '应用卡片' },
  { id: 'current', type: 'guide', category: '当前应用' }
]
assert.equal(pickBaseRecommendedGuide(guides)?.id, 'current')
assert.equal(pickBaseRecommendedGuide(guides.slice(0, 3))?.id, 'card-one')
assert.equal(pickBaseRecommendedGuide(guides.slice(0, 2))?.id, 'cards-app-cards')
assert.equal(pickBaseRecommendedGuide(guides, true, (guide) => guide.id !== 'base')?.id, 'base')
assert.equal(pickBaseRecommendedGuide([], true)?.id, undefined)

const longDescription = `${'前'.repeat(40)}。${'后'.repeat(200)}`
assert.equal(shortenBaseGuideDescription(longDescription), `${'前'.repeat(40)}。`)
assert.equal(shortenBaseGuideDescription('abc', 2), 'ab...')
assert.deepEqual(compactBaseGuideSteps([{
  element: '#save',
  popover: { title: '保存', description: 'a'.repeat(181), side: 'bottom' }
}]), [{
  element: '#save',
  popover: { title: '保存', description: `${'a'.repeat(180)}...`, side: 'bottom' }
}])

assert.deepEqual(normalizeBaseGuideProgressEntry('2026-09-01'), { seenAt: '2026-09-01', completedAt: '' })
assert.deepEqual(normalizeBaseGuideProgressEntry({ seen_at: 'seen', completed_at: 'done' }), { seenAt: 'seen', completedAt: 'done' })
assert.deepEqual(normalizeBaseGuideProgressEntry({ viewedAt: 'viewed' }), { seenAt: 'viewed', completedAt: '' })
assert.equal(normalizeBaseGuideProgressEntry(1), null)
assert.deepEqual(normalizeBaseGuideProgress({ a: 'seen', b: null, c: { completedAt: 'done' } }), {
  a: { seenAt: 'seen', completedAt: '' },
  c: { seenAt: '', completedAt: 'done' }
})

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/base-layout-guide-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `base layout guide policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/base-layout-guide-policy['"]/)
for (const removedDefinition of [
  'const SOP_ROLE_ALIASES =',
  'const normalizeSopRole =',
  'const normalizeGuideText =',
  'const normalizeGuideId =',
  'const parseSopStepTexts =',
  'const normalizeExternalGuide =',
  'const pickRecommendedGuide =',
  'const shortenGuideDescription =',
  'const compactGuideSteps =',
  'const normalizeGuideProgressEntry ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `base layout reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'normalizeBaseSopRole(',
  'normalizeBaseGuideText(',
  'normalizeBaseGuideId(',
  'parseBaseSopStepTexts(',
  'normalizeBaseExternalGuide(',
  'pickBaseRecommendedGuide(',
  'compactBaseGuideSteps(',
  'normalizeBaseGuideProgressEntry(',
  'normalizeBaseGuideProgress('
]) {
  assert.equal(pageSource.includes(requiredUse), true, `base layout lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3535)

console.log('PASS: base layout guide policy preserves SOP roles, guide normalization, recommendation, compaction and progress compatibility')
