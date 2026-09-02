// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOM_ITEMS,
  DATA_STATUS,
  DEFAULT_DEMO_STEP,
  DEMO_PRODUCT,
  QUALITY_GATES,
  WAREHOUSE_ZONES,
  WORK_CENTERS,
  WORKFLOW_STEPS,
  createDemoSnapshot,
  validateDemoModel
} from '../src/demo/factory-demo.js'

test('factory demo keeps the confirmed one-piece ash cue scenario intact', () => {
  assert.deepEqual(validateDemoModel(), [])
  assert.equal(DEMO_PRODUCT.customerName, '君乐缘球房')
  assert.equal(DEMO_PRODUCT.quantity, 20)
  assert.equal(DEMO_PRODUCT.leadTimeDays, 30)
  assert.equal(DEMO_PRODUCT.structure, '通杆')
  assert.equal(DEMO_PRODUCT.primaryMaterial, '白蜡木')
  assert.equal(DEMO_PRODUCT.appearance, '纯木纹')
  assert.equal(DEMO_PRODUCT.finish, '透明哑光')
  assert.equal(DEMO_PRODUCT.price, '待报价')
})

test('factory demo covers every agreed operational domain without writing real facts', () => {
  assert.equal(WORK_CENTERS.length, 3)
  assert.equal(QUALITY_GATES.length, 4)
  assert.equal(WAREHOUSE_ZONES.length, 4)
  assert.ok(BOM_ITEMS.some((item) => item.name === '白蜡木通杆坯'))
  assert.ok(WORKFLOW_STEPS.some((item) => item.module === 'sales'))
  assert.ok(WORKFLOW_STEPS.some((item) => item.module === 'purchase'))
  assert.ok(WORKFLOW_STEPS.some((item) => item.module === 'warehouse'))
  assert.ok(WORKFLOW_STEPS.some((item) => item.module === 'production'))
  assert.ok(WORKFLOW_STEPS.some((item) => item.module === 'quality'))
  assert.ok(Object.values(DATA_STATUS).every((item) => item.label && item.note))
})

test('workflow snapshots advance predictably and keep demo quantities explicit', () => {
  const initial = createDemoSnapshot(0)
  const production = createDemoSnapshot(DEFAULT_DEMO_STEP)
  const quality = createDemoSnapshot(6)
  const delivered = createDemoSnapshot(99)

  assert.equal(initial.progress, 0)
  assert.equal(initial.metrics.materialGap, 8)
  assert.equal(production.stage.id, 'production')
  assert.equal(production.metrics.workInProgress, 20)
  assert.equal(quality.metrics.passedQuantity, 18)
  assert.equal(quality.metrics.reworkQuantity, 2)
  assert.equal(delivered.progress, 100)
  assert.equal(delivered.metrics.deliveredQuantity, 20)
  assert.equal(delivered.nextAction, null)
})
