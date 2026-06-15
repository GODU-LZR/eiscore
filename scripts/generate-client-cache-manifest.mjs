#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(process.argv[2] || 'output/nanpai-eiscore-release')
const outputFile = path.join(rootDir, 'asset-manifest.json')

const CACHEABLE_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot'
])

const EXCLUDED_BASENAMES = new Set([
  'asset-manifest.json',
  'sw.js'
])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

function toUrl(filePath) {
  const rel = path.relative(rootDir, filePath).split(path.sep).join('/')
  return `/${rel}`
}

const files = await walk(rootDir)
const records = []

for (const file of files) {
  const basename = path.basename(file)
  if (EXCLUDED_BASENAMES.has(basename)) continue
  if (!CACHEABLE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue
  const info = await stat(file)
  records.push({
    url: toUrl(file),
    size: info.size,
    mtimeMs: Math.floor(info.mtimeMs)
  })
}

function priority(record) {
  const url = record.url
  if (url === '/index.html' || url === '/favicon.ico') return 0
  if (url.startsWith('/assets/runtime-') || url.startsWith('/assets/vue-runtime-')) return 1
  if (url.startsWith('/assets/index-') || url.startsWith('/assets/utils-') || url.startsWith('/assets/micro-app-')) return 2
  if (url.startsWith('/assets/element-plus-') || url.startsWith('/assets/vendor-misc-')) return 3
  if (/^\/(?:hr|materials|apps|sales|purchase|production|quality|equipment|decision|mobile)\/index\.html$/.test(url)) return 4
  if (/^\/(?:hr|materials|apps|sales|purchase|production|quality|equipment|decision|mobile)\/assets\/(?:runtime|vue-runtime|index|utils|micro-app|request|element-plus)-/.test(url)) return 5
  if (/^\/apps\/assets\/(?:AppRuntime|DataApp|AppDashboard|AppConfigCenter|AppRecordDetail|WorkflowApprovalCenter|FlowDesigner|FlashBuilder|OntologyWorkbench)-/.test(url)) return 5
  if (/^\/(?:hr|materials|sales|purchase|production|quality|equipment|decision)\/assets\/.*(?:AppView|AppGrid|Apps|Dashboard|Cockpit|Overview|Inventory|Home)-/.test(url)) return 5
  if (/^\/(?:hr|materials|apps|sales|purchase|production|quality|equipment|decision|mobile)\/assets\//.test(url)) return record.size > 600 * 1024 ? 8 : 6
  if (url.startsWith('/assets/') && record.size > 600 * 1024) return 9
  return 7
}

records.sort((a, b) => {
  const priorityDelta = priority(a) - priority(b)
  if (priorityDelta) return priorityDelta
  const sizeDelta = a.size - b.size
  if (sizeDelta) return sizeDelta
  return a.url.localeCompare(b.url)
})

const hash = createHash('sha256')
for (const record of records) {
  hash.update(`${record.url}\0${record.size}\0${record.mtimeMs}\n`)
}

const manifest = {
  version: hash.digest('hex').slice(0, 16),
  generatedAt: new Date().toISOString(),
  count: records.length,
  totalBytes: records.reduce((sum, record) => sum + record.size, 0),
  urls: records.map((record) => record.url)
}

await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Generated ${outputFile}`)
console.log(`Cached URLs: ${manifest.count}`)
console.log(`Total bytes: ${manifest.totalBytes}`)
