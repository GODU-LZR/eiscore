// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..')

const legacyRoots = [
  { path: '.', recursive: false },
  { path: 'env', recursive: false },
  { path: 'sql', recursive: false },
  { path: 'eiscore-hr/sql', recursive: false },
  { path: 'eiscore-materials/sql', recursive: false }
]

const manifestPaths = [
  'database/migrations/runtime-v2.json',
  'database/migrations/company-site.json'
]

const normalizePath = (value) => String(value).replaceAll('\\', '/')

const directSqlFiles = (repoRoot, root) => readdirSync(resolve(repoRoot, root), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
  .map((entry) => normalizePath(root === '.' ? entry.name : `${root}/${entry.name}`))
  .sort()

export const analyzeProductionCompose = (source) => {
  const runtimeSuperuserConnections = []
  if (/PGRST_DB_URI:\s*["']?postgres:\/\/postgres:/i.test(source)) {
    runtimeSuperuserConnections.push({ service: 'api', setting: 'PGRST_DB_URI', role: 'postgres' })
  }
  if (/\bPGUSER:\s*["']?postgres["']?\s*$/im.test(source)) {
    runtimeSuperuserConnections.push({ service: 'agent-runtime', setting: 'PGUSER', role: 'postgres' })
  }

  const exposedSchemas = source.match(/PGRST_DB_SCHEMAS:\s*["']([^"']+)["']/)?.[1]
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) || []

  const images = [...source.matchAll(/^\s{4}image:\s*([^\s#]+)\s*$/gm)].map((match) => match[1])
  const initializationInputs = [...source.matchAll(/^\s*-\s+\.\/(.+?):\/docker-entrypoint-initdb\.d\/.+$/gm)]
    .map((match) => normalizePath(match[1]))

  return { runtimeSuperuserConnections, exposedSchemas, images, initializationInputs }
}

export const auditDatabaseBackend = ({ repoRoot = defaultRepoRoot } = {}) => {
  const inventory = legacyRoots.map((entry) => ({
    ...entry,
    files: directSqlFiles(repoRoot, entry.path)
  }))
  const legacyFiles = inventory.flatMap((entry) => entry.files)
  const manifests = manifestPaths.map((path) => {
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'))
    return {
      path,
      name: manifest.name,
      migrations: manifest.migrations.map((entry) => normalizePath(entry.path))
    }
  })
  const governedPaths = new Set(manifests.flatMap((entry) => entry.migrations))
  const governedLegacyFiles = legacyFiles.filter((path) => governedPaths.has(path))
  const productionCompose = analyzeProductionCompose(
    readFileSync(resolve(repoRoot, 'docker-compose.prod.yml'), 'utf8')
  )

  return {
    schemaVersion: 1,
    legacyRoots: inventory.map(({ path, recursive, files }) => ({ path, recursive, count: files.length })),
    legacySqlFiles: legacyFiles.length,
    governedMigrationFiles: governedPaths.size,
    governedLegacySqlFiles: governedLegacyFiles.length,
    ungovernedLegacySqlFiles: legacyFiles.length - governedLegacyFiles.length,
    manifests: manifests.map(({ path, name, migrations }) => ({ path, name, count: migrations.length })),
    productionCompose
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const result = auditDatabaseBackend()
  if (process.argv.includes('--format=json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log([
      'PASS: database backend transition baseline',
      `${result.legacySqlFiles} legacy SQL files`,
      `${result.governedLegacySqlFiles} governed legacy SQL files`,
      `${result.ungovernedLegacySqlFiles} ungoverned legacy SQL files`,
      `${result.governedMigrationFiles} governed migrations`,
      `${result.productionCompose.runtimeSuperuserConnections.length} runtime superuser connections`
    ].join(', '))
  }
}
