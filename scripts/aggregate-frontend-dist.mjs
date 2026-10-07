// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const hostDist = resolve(repoRoot, 'eiscore-base/dist')
const apps = {
  hr: 'eiscore-hr',
  materials: 'eiscore-materials',
  apps: 'eiscore-apps',
  'company-site': 'eiscore-company-site',
  sales: 'eiscore-sales',
  purchase: 'eiscore-purchase',
  production: 'eiscore-production',
  quality: 'eiscore-quality',
  equipment: 'eiscore-equipment',
  decision: 'eiscore-decision',
  mobile: 'eiscore-mobile'
}

if (!existsSync(resolve(hostDist, 'index.html'))) {
  throw new Error(`Base frontend dist is missing index.html: ${hostDist}`)
}

let count = 0
for (const [mount, packageName] of Object.entries(apps)) {
  const source = resolve(repoRoot, packageName, 'dist')
  const sourceIndex = resolve(source, 'index.html')
  if (!existsSync(sourceIndex)) {
    throw new Error(`Frontend dist is missing index.html: ${source}`)
  }
  const destination = resolve(hostDist, mount)
  mkdirSync(destination, { recursive: true })
  cpSync(source, destination, { recursive: true, force: true })
  count += 1
}

const manifest = {
  generatedAt: new Date().toISOString(),
  host: 'eiscore-base',
  mounts: Object.keys(apps),
  count
}
mkdirSync(resolve(hostDist, 'config'), { recursive: true })
// Keep a small deployment proof next to the static output; it is not runtime configuration.
const manifestPath = resolve(hostDist, 'config/frontend-dist-manifest.json')
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[ok] aggregated ${count} micro-frontend dist directories into ${hostDist}`)
