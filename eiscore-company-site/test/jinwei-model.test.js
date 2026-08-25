// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JINWEI_ATTENTION_ITEMS,
  JINWEI_DEMO_ORDER,
  JINWEI_PRODUCT_FAMILIES,
  JINWEI_RESEARCH_SUMMARY,
  JINWEI_SPEC_FIELDS,
  calcJinweiAttentionScore,
  createJinweiSnapshot,
  scoreToJinweiAttention,
  validateJinweiModel
} from '../src/jinwei/model.js'

test('research inventory preserves duplicate-aware source counts', () => {
  assert.equal(JINWEI_RESEARCH_SUMMARY.totalFiles, 80)
  assert.equal(JINWEI_RESEARCH_SUMMARY.images, 72)
  assert.equal(JINWEI_RESEARCH_SUMMARY.uniqueImages, 70)
  assert.equal(JINWEI_RESEARCH_SUMMARY.uniqueWordReports, 2)
})

test('model covers the four researched product families and required specification fields', () => {
  assert.deepEqual(JINWEI_PRODUCT_FAMILIES.map((item) => item.id), ['knotted-net', 'knotless-net', 'rope', 'cage-net'])
  for (const key of ['material', 'construction', 'yarnSpec', 'meshSize', 'dimensions', 'color', 'weight', 'packing']) {
    assert.ok(JINWEI_SPEC_FIELDS.some((item) => item.key === key && item.required), key)
  }
  assert.deepEqual(validateJinweiModel(), [])
})

test('attention score is deterministic and keeps specification lock critical', () => {
  const item = JINWEI_ATTENTION_ITEMS.find((entry) => entry.id === 'spec-lock')
  const score = calcJinweiAttentionScore(item, { role: 'planner' })
  assert.equal(scoreToJinweiAttention(score), 'critical')
  assert.equal(calcJinweiAttentionScore(item, { role: 'planner' }), score)
})

test('workflow snapshots advance without converting historical workbook data into live facts', () => {
  const early = createJinweiSnapshot(1, 'planner')
  const late = createJinweiSnapshot(8, 'warehouse')
  assert.equal(early.workflow[1].state, 'active')
  assert.equal(late.metrics.finishedPieces, JINWEI_DEMO_ORDER.quantityPieces)
  assert.equal(late.metrics.deliveredPieces, JINWEI_DEMO_ORDER.quantityPieces)
  assert.match(JINWEI_DEMO_ORDER.orderNo, /DEMO/)
  assert.ok(early.attention.some((item) => item.id === 'spec-lock'))
})
