import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Reuse the shared generator, then cache only this deployment's public entries.
await import('../../scripts/generate-client-cache-manifest.mjs')
const root = resolve(process.argv[2])
const file = resolve(root, 'asset-manifest.json')
const manifest = JSON.parse(readFileSync(file, 'utf8'))
manifest.urls = manifest.urls.filter((url) => !url.startsWith('/company-site/'))
manifest.count = manifest.urls.length
manifest.totalBytes = manifest.urls.reduce((sum, url) => sum + statSync(resolve(root, '.' + url)).size, 0)
manifest.version = createHash('sha256').update(manifest.version).update(JSON.stringify(manifest.urls)).digest('hex').slice(0, 16)
writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Public cache resources: ${manifest.count}; company-site remains unpublished`)
