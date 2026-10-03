// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')

const section = (start, end) => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, 'missing section: ' + start)
  assert.notEqual(endIndex, -1, 'missing section boundary: ' + end)
  return source.slice(startIndex, endIndex)
}

assert.match(source, /import\s*{[^}]*\bgetHostHttpClient\b[^}]*}\s*from\s*['"]@\/platform\/http-client['"]/, 'AI Copilot must use the shared host HTTP client')
assert.match(source, /import\s*{[^}]*\bgetHostSystemConfigService\b[^}]*}\s*from\s*['"]@\/platform\/http-client['"]/, 'AI Copilot must use the shared system-config service')

const templateLibrary = section('const loadTemplateLibrary = async () => {', 'const buildTemplateRecord = (schema) => {')
assert.doesNotMatch(templateLibrary, /\bfetch\s*\(|getAuthToken|Authorization/)
assert.match(templateLibrary, /getHostSystemConfigService\(\)\.readValue\(getCurrentTemplateLibraryKey\(\)\)/)
assert.match(templateLibrary, /return Array\.isArray\(value\) \? value : \[\]/)
assert.match(templateLibrary, /getHostSystemConfigService\(\)\.saveValue\(key, templates\)/)
assert.match(templateLibrary, /catch \(e\) \{\s*return \[\]/)

const saveFormTemplate = section('const saveFormTemplate = async (schema, messageKey) => {', 'const isStreamingMessage = (index) => {')
assert.match(saveFormTemplate, /const saved = await saveTemplateLibrary\(templates\)/)
assert.match(saveFormTemplate, /if \(!saved\) throw new Error\(['"]保存失败['"]\)/)

const saveConfig = section('const saveSystemConfig = async (key, value) => {', 'const getNextSegment = (siblings = []) => {')
assert.doesNotMatch(saveConfig, /\bfetch\s*\(|Authorization/)
assert.match(saveConfig, /const token = getAuthToken\(\)/)
assert.match(saveConfig, /if \(token && isTokenExpired\(token\)/)
assert.match(saveConfig, /getHostSystemConfigService\(\)\.saveValue\(key, value\)/)
assert.ok(saveConfig.includes("error?.code === 'unauthorized'"))
assert.match(saveConfig, /throw new Error\(['"]登录已过期['"]\)/)
assert.match(saveConfig, /throw new Error\(['"]保存失败['"]\)/)

const categoryImport = section('const applyCategoryImport = async (info, messageKey) => {', 'const resolveAssociatedTable = (meta = {}) =>')
assert.doesNotMatch(categoryImport, /\bfetch\s*\(|Authorization/)
assert.ok(categoryImport.includes("getHostHttpClient().requestJson('/system_configs?key=eq.materials_categories'"))
assert.match(categoryImport, /catch \(e\) \{\s*existingJson = \[\]/)
assert.match(categoryImport, /await saveSystemConfig\(['"]materials_categories['"], nextList\)/)

console.log('PASS: AI Copilot system configurations use platform HTTP')
