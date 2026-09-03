// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
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
  'database/migrations/company-site.json',
  'database/migrations/core.json'
]

const normalizePath = (value) => String(value).replaceAll('\\', '/')
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const directSqlFiles = (repoRoot, root) => readdirSync(resolve(repoRoot, root), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
  .map((entry) => normalizePath(root === '.' ? entry.name : `${root}/${entry.name}`))
  .sort()

const countMatches = (source, pattern) => (source.match(pattern) || []).length

export const classifyLegacySql = ({ path, source, governed }) => {
  const filename = path.split('/').at(-1).toLowerCase()
  const customerNamed = /(jinwei|junleyuan|nanpai)/.test(filename)
  const demoOrTestNamed = /(demo|test_account)/.test(filename)
  const patchNamed = /(^patch_|_patch\.sql$|^fix_|_fix\.sql$|^backfill_|^normalize_|dedupe)/.test(filename)
  const referenceSeedNamed = /(permission_seed|field_acl_templates|role_permission_templates_v2)/.test(filename)
  const schemaFragmentNamed = /(_views?\.sql$|_api\.sql$|_wrapper\.sql$|_comments\.sql$)/.test(filename)

  if (governed) return { category: 'governed-migration', disposition: 'keep-governed' }
  if (path === 'db_schema_and_data.sql') {
    return { category: 'baseline-snapshot', disposition: 'baseline-candidate-review' }
  }
  if (['init_roles.sql', 'insert_ai_config.sql', 'env/init_roles.sql', 'env/insert_ai_config.sql'].includes(path)) {
    return { category: 'environment-bootstrap', disposition: 'separate-role-or-secret-config' }
  }
  if (filename.includes('postcheck')) return { category: 'postcheck', disposition: 'keep-verification' }
  if (customerNamed) return { category: 'customer-seed', disposition: 'separate-customer-data' }
  if (demoOrTestNamed || filename === 'hr_auth_seed.sql') {
    return { category: 'demo-or-test', disposition: 'separate-demo-data' }
  }
  if (referenceSeedNamed) return { category: 'reference-seed', disposition: 'separate-reference-data' }
  if (patchNamed) return { category: 'legacy-patch', disposition: 'supersession-review' }
  if (schemaFragmentNamed) return { category: 'schema-fragment', disposition: 'baseline-component-review' }

  const hasSchemaDdl = /\b(create|alter)\s+(schema|table|view|materialized\s+view|function|trigger|type|sequence|policy|index)\b/i.test(source)
  if (hasSchemaDdl) return { category: 'schema-fragment', disposition: 'baseline-component-review' }
  return { category: 'data-or-operation', disposition: 'manual-purpose-review' }
}

const inspectLegacySql = ({ repoRoot, path, governedPaths }) => {
  const bytes = readFileSync(resolve(repoRoot, path))
  const source = bytes.toString('utf8')
  const governed = governedPaths.has(path)
  return {
    path,
    bytes: bytes.length,
    sha256: sha256(bytes),
    governed,
    ...classifyLegacySql({ path, source, governed }),
    signals: {
      createTable: countMatches(source, /\bcreate\s+table\b/gi),
      createFunction: countMatches(source, /\bcreate(?:\s+or\s+replace)?\s+function\b/gi),
      createPolicy: countMatches(source, /\bcreate\s+policy\b/gi),
      enableRls: countMatches(source, /\benable\s+row\s+level\s+security\b/gi),
      securityDefiner: countMatches(source, /\bsecurity\s+definer\b/gi),
      grants: countMatches(source, /\bgrant\s+/gi),
      inserts: countMatches(source, /\binsert\s+into\b/gi)
    }
  }
}

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
  const files = legacyFiles.map((path) => inspectLegacySql({ repoRoot, path, governedPaths }))
  const governedLegacyFiles = files.filter((entry) => entry.governed)
  const categories = Object.fromEntries(
    [...new Set(files.map((entry) => entry.category))]
      .sort()
      .map((category) => [category, files.filter((entry) => entry.category === category).length])
  )
  const filesByHash = new Map()
  for (const entry of files) {
    const entries = filesByHash.get(entry.sha256) || []
    entries.push(entry)
    filesByHash.set(entry.sha256, entries)
  }
  const duplicateContentGroups = [...filesByHash.values()]
    .filter((entries) => entries.length > 1)
    .map((entries) => entries.map((entry) => entry.path).sort())
    .sort((left, right) => left[0].localeCompare(right[0]))
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
    categories,
    duplicateContentGroups,
    files,
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
      `${result.productionCompose.runtimeSuperuserConnections.length} runtime superuser connections`,
      `${result.duplicateContentGroups.length} duplicate content groups`,
      `categories ${JSON.stringify(result.categories)}`
    ].join(', '))
  }
}
