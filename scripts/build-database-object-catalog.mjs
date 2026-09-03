// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export const buildDatabaseObjectCatalog = (schemaBuffer) => {
  const schema = Buffer.isBuffer(schemaBuffer) ? schemaBuffer : Buffer.from(schemaBuffer)
  const text = schema.toString('utf8')
  const objects = []
  const pattern = /^-- Name: (.+); Type: ([^;]+); Schema: ([^;]+); Owner: (.*)$/gm
  for (const match of text.matchAll(pattern)) {
    objects.push({ name: match[1], type: match[2], schema: match[3] })
    if (match[4] !== '-') throw new Error(`canonical schema contains an owner: ${match[4]}`)
  }
  objects.sort((left, right) => [left.type, left.schema, left.name]
    .join('\0').localeCompare([right.type, right.schema, right.name].join('\0'), 'en'))

  const counts = {}
  for (const { type } of objects) counts[type] = (counts[type] || 0) + 1

  const dumpedFrom = text.match(/^-- Dumped from database version (.+)$/m)?.[1] || ''
  const dumpedBy = text.match(/^-- Dumped by pg_dump version (.+)$/m)?.[1] || ''
  if (!dumpedFrom || !dumpedBy || objects.length === 0) {
    throw new Error('input is not a complete plain-text PostgreSQL schema dump')
  }

  return {
    schemaVersion: 1,
    schemaSha256: sha256(schema),
    schemaBytes: schema.length,
    dumpedFrom,
    dumpedBy,
    objectCount: objects.length,
    counts: Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, 'en'))),
    objects
  }
}

export const serializeDatabaseObjectCatalog = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const schemaArg = process.argv.find((argument) => argument.startsWith('--schema='))
  const outputArg = process.argv.find((argument) => argument.startsWith('--output='))
  if (!schemaArg || !outputArg) {
    console.error('usage: node scripts/build-database-object-catalog.mjs --schema=<schema.sql> --output=<catalog.json>')
    process.exitCode = 1
  } else {
    try {
      const schemaPath = resolve(schemaArg.slice('--schema='.length))
      const outputPath = resolve(outputArg.slice('--output='.length))
      const catalog = buildDatabaseObjectCatalog(readFileSync(schemaPath))
      writeFileSync(outputPath, serializeDatabaseObjectCatalog(catalog))
      console.log(`PASS: database object catalog generated (${catalog.objectCount} objects, ${catalog.schemaSha256})`)
    } catch (error) {
      console.error(`[error] ${error.message}`)
      process.exitCode = 1
    }
  }
}
