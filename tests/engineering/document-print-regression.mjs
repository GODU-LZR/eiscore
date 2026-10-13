// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 EISCore contributors

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { cloneDocumentForPrint } from '../../shared/eis-document-print.js'

const root = resolve(import.meta.dirname, '../..')
const pages = [
  'eiscore-apps/src/views/AppRecordDetail.vue',
  'eiscore-materials/src/views/MaterialDetail.vue',
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue',
  'eiscore-equipment/src/views/EquipmentDocumentDetail.vue',
  'eiscore-quality/src/views/QualityDocumentDetail.vue'
]
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent('<div id="paper"><div class="el-date-editor"><input value="old-date"></div><div class="el-input-number"><input value="1"></div><textarea>old-note</textarea><select><option>old-option</option><option>selected label</option></select><input type="checkbox"><input type="hidden" value="internal"><span class="el-select__selected-item">中文选项</span><button>删除</button></div>')
  await page.evaluate(() => {
    const fields = document.querySelectorAll('input, textarea, select')
    fields[0].value = '2026-10-13'
    fields[1].value = '42'
    fields[2].value = '<img src=x onerror=alert(1)>'
    fields[3].selectedIndex = 1
    fields[4].checked = true
    const script = document.createElement('script')
    script.textContent = 'unused'
    document.querySelector('#paper').append(script)
    document.querySelector('#paper').setAttribute('onclick', 'unused')
    document.querySelector('span').setAttribute('onmouseover', 'unused')
  })
  await page.evaluate(`window.cloneDocumentForPrint = ${cloneDocumentForPrint.toString()}`)
  const printed = await page.evaluate(() => {
    const paper = document.querySelector('#paper')
    const clone = window.cloneDocumentForPrint(paper)
    return { html: clone.outerHTML, text: clone.textContent, originalValue: paper.querySelector('input').value }
  })
  assert.match(printed.text, /2026-10-13/)
  assert.match(printed.text, /42/)
  assert.match(printed.text, /selected label/)
  assert.match(printed.text, /✓/)
  assert.match(printed.text, /中文选项/)
  assert.doesNotMatch(printed.text, /old-date|old-note|old-option|internal/)
  assert.doesNotMatch(printed.html, /<(?:input|textarea|select|img)\b/)
  assert.match(printed.html, /&lt;img/)
  assert.doesNotMatch(printed.html, /<script|onclick=|onmouseover=/)
  assert.equal(printed.originalValue, '2026-10-13')

  for (const file of pages) {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.match(source, /import \{ cloneDocumentForPrint \} from '@shared\/eis-document-print\.js'/)
    const style = source.match(/const styleText = (?:`([\s\S]*?)`|'([^'\r\n]*)')/)?.slice(1).find(Boolean)
    assert.ok(style, `${file} must retain popup print styles`)
    await page.setContent(`<style>${style}</style>${printed.html}`)
    assert.equal(await page.locator('button').isVisible(), false)
    assert.equal(await page.locator('.el-date-editor').innerText(), '2026-10-13')
    assert.equal(await page.locator('.el-input-number').innerText(), '42')
    assert.equal(await page.locator('.el-select__selected-item').innerText(), '中文选项')
  }
} finally {
  await browser.close()
}
console.log('PASS: popup document printing preserves live date, number, text and selected labels across five modules')
