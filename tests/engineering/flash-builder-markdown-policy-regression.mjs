// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  escapeFlashHtml,
  isSafeFlashMarkdownUrl,
  renderFlashInlineMarkdown,
  renderFlashMarkdown,
  renderFlashMarkdownTable
} from '../../eiscore-apps/src/domain/flash-builder-markdown-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(escapeFlashHtml(`<script data-x="'">&`), '&lt;script data-x=&quot;&#39;&quot;&gt;&amp;')
for (const value of ['https://eiscore.example/a', 'HTTP://EISCORE.EXAMPLE', 'mailto:test@example.com', 'tel:123', '#part', '/apps', './a', '../a']) {
  assert.equal(isSafeFlashMarkdownUrl(value), true, `${value} should remain linkable`)
}
for (const value of ['', 'javascript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,<script>1</script>', 'ftp://example.com']) {
  assert.equal(isSafeFlashMarkdownUrl(value), false, `${value} should not become a link`)
}

assert.equal(
  renderFlashInlineMarkdown('**粗体** *斜体* __加粗__ _倾斜_ ~~删除~~ `代码` <img>'),
  '<strong>粗体</strong> <em>斜体</em> <strong>加粗</strong> <em>倾斜</em> <del>删除</del> <code>代码</code> &lt;img&gt;'
)
assert.equal(
  renderFlashInlineMarkdown('[安全](https://eiscore.example) [危险](javascript:alert(1))'),
  '<a href="https://eiscore.example" target="_blank" rel="noopener noreferrer">安全</a> 危险)'
)

assert.equal(renderFlashMarkdownTable(['only one']), '')
assert.equal(renderFlashMarkdownTable(['A | B', 'not-divider']), '')
assert.equal(
  renderFlashMarkdownTable(['| A | B |', '| --- | :---: |', '| 1 | **2** |']),
  '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table>'
)

assert.equal(renderFlashMarkdown(''), '')
assert.equal(renderFlashMarkdown('# 标题'), '<h1>标题</h1>')
assert.equal(renderFlashMarkdown('> 引用\n> 第二行'), '<blockquote>引用<br/>第二行</blockquote>')
assert.equal(renderFlashMarkdown('- A\n- B'), '<ul><li>A</li><li>B</li></ul>')
assert.equal(renderFlashMarkdown('1. A\n2. B'), '<ol><li>A</li><li>B</li></ol>')
assert.equal(renderFlashMarkdown('第一行\n第二行'), '<p>第一行<br/>第二行</p>')
assert.equal(
  renderFlashMarkdown('```html\n<script>alert(1)</script>\n```'),
  '<pre class="md-code"><code>&lt;script&gt;alert(1)&lt;/script&gt;\n</code><span class="lang">html</span></pre>'
)
const mixed = renderFlashMarkdown('## 标题\n\n| A |\n| --- |\n| x |\n\n正文')
assert.equal(mixed, '<h2>标题</h2><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table><p>正文</p>')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/flash-builder-markdown-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date', 'DOMParser']) {
  assert.equal(moduleSource.includes(forbidden), false, `FlashBuilder markdown policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/flash-builder-markdown-policy['"]/)
for (const removedDefinition of [
  'const escapeHtml =',
  'const isSafeMarkdownUrl =',
  'const renderInlineMarkdown =',
  'const renderMarkdownTable ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `FlashBuilder reintroduced ${removedDefinition}`)
}
assert.equal(pageSource.includes('renderFlashMarkdown(source)'), true)
assert.ok(pageSource.split(/\r?\n/).length <= 3808)

console.log('PASS: FlashBuilder markdown policy preserves escaping, safe links, inline syntax, tables, blocks and code fences')
