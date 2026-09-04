// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const allowedModes = new Set(['deny-additions-not-in-baseline'])
const relationKinds = new Map([
  ['r', 'TABLE'], ['p', 'TABLE'], ['v', 'VIEW'], ['m', 'MATERIALIZED VIEW'],
  ['f', 'FOREIGN TABLE'], ['S', 'SEQUENCE']
])

const safePath = (repoRoot, repoPath) => {
  const absolute = resolve(repoRoot, String(repoPath || '').replaceAll('\\', '/'))
  const relation = relative(repoRoot, absolute)
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error(`public Schema ratchet path must stay inside the repository: ${repoPath}`)
  }
  return absolute
}

const objectKey = (type, name) => `${type}:${name}`

export const baselinePublicObjects = (catalog, descriptor) => new Set(
  (catalog?.objects || [])
    .filter((entry) => entry.schema === descriptor.schema)
    .filter((entry) => descriptor.governedObjectTypes.includes(entry.type))
    .map((entry) => objectKey(entry.type, entry.name))
)

export const runtimePublicObjects = (catalog, descriptor) => {
  const keys = []
  for (const relation of catalog?.relations || []) {
    if (relation.schema !== descriptor.schema) continue
    const type = relationKinds.get(relation.kind)
    if (type && descriptor.governedObjectTypes.includes(type)) keys.push(objectKey(type, relation.name))
  }
  for (const routine of catalog?.functions || []) {
    if (routine.schema !== descriptor.schema || routine.extension) continue
    const type = routine.kind === 'p' ? 'PROCEDURE' : 'FUNCTION'
    keys.push(objectKey(type, `${routine.name}(${routine.identityTypes ?? routine.identityArguments})`))
  }
  for (const type of catalog?.types || []) {
    if (type.schema === descriptor.schema && !type.extension) keys.push(objectKey('TYPE', type.name))
  }
  for (const trigger of catalog?.triggers || []) {
    if (trigger.schema === descriptor.schema) keys.push(objectKey('TRIGGER', `${trigger.table} ${trigger.name}`))
  }
  return new Set(keys)
}

export const validatePublicSchemaCatalog = ({ catalog, descriptor, baselineCatalog }) => {
  const errors = []
  const baseline = baselinePublicObjects(baselineCatalog, descriptor)
  const approved = new Set((descriptor.approvedAdditions || []).flatMap((entry) => entry.objects || []))
  const current = runtimePublicObjects(catalog, descriptor)
  for (const key of current) {
    if (!baseline.has(key) && !approved.has(key)) errors.push(`unapproved public object addition: ${key}`)
  }
  return { errors, currentObjects: current.size, baselineObjects: baseline.size }
}

export const validatePublicSchemaRatchet = ({ repoRoot, descriptorPath = 'database/public-schema-ratchet.json' }) => {
  const errors = []
  let descriptor = {}
  let baselineCatalog = {}
  try {
    descriptor = JSON.parse(readFileSync(safePath(repoRoot, descriptorPath), 'utf8'))
  } catch (error) {
    return { errors: [`cannot read public Schema ratchet: ${error.message}`], descriptor, baselineCatalog }
  }
  if (descriptor.schemaVersion !== 1) errors.push('public Schema ratchet schemaVersion must equal 1')
  if (descriptor.schema !== 'public') errors.push('public Schema ratchet must govern public')
  if (!allowedModes.has(descriptor.mode)) errors.push('public Schema ratchet mode is invalid')
  if (!Array.isArray(descriptor.governedObjectTypes) || descriptor.governedObjectTypes.length === 0) {
    errors.push('public Schema ratchet object types are missing')
  }
  try {
    const bytes = readFileSync(safePath(repoRoot, descriptor.baselineObjectCatalog?.path))
    if (sha256(bytes) !== descriptor.baselineObjectCatalog?.sha256) {
      errors.push('public Schema baseline object catalog checksum drift')
    }
    baselineCatalog = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    errors.push(`cannot read public Schema baseline catalog: ${error.message}`)
  }
  for (const exception of descriptor.approvedAdditions || []) {
    if (!/^core-[0-9]{3}$/.test(exception.migrationId || '')) errors.push('approved public addition requires a core migration ID')
    if (!/^docs\/engineering\/adr\/[0-9]{4}-.+[.]md$/.test(exception.adr || '')) errors.push('approved public addition requires an ADR')
    if (!Array.isArray(exception.objects) || exception.objects.length === 0) errors.push('approved public addition requires object keys')
  }
  return { errors, descriptor, baselineCatalog }
}

export const extractExplicitPublicCreations = (source) => {
  const creations = []
  const objectPattern = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(MATERIALIZED\s+VIEW|FOREIGN\s+TABLE|TABLE|VIEW|FUNCTION|PROCEDURE|TYPE|SEQUENCE)\s+(?:IF\s+NOT\s+EXISTS\s+)?public[.]([a-zA-Z_][a-zA-Z0-9_$]*)/gi
  for (const match of source.matchAll(objectPattern)) {
    creations.push({ type: match[1].toUpperCase().replace(/\s+/g, ' '), name: match[2] })
  }
  const triggerPattern = /\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z_][a-zA-Z0-9_$]*)[\s\S]{0,1000}?\bON\s+public[.]([a-zA-Z_][a-zA-Z0-9_$]*)/gi
  for (const match of source.matchAll(triggerPattern)) creations.push({ type: 'TRIGGER', name: `${match[2]} ${match[1]}` })
  return creations
}

export const creationAllowedBy = (creation, allowedKeys) => {
  const exact = objectKey(creation.type, creation.name)
  if (allowedKeys.has(exact)) return true
  if (creation.type === 'FUNCTION' || creation.type === 'PROCEDURE') {
    return [...allowedKeys].some((key) => key.startsWith(`${creation.type}:${creation.name}(`))
  }
  return false
}
