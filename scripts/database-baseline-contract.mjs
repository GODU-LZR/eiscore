// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export const sha256File = (path) => sha256(readFileSync(path))

const immutableDescriptor = (descriptor) => {
  const { portableSha256, portableBytes, ...immutable } = descriptor || {}
  return immutable
}

export const baselineFingerprintPayload = (manifest) => ({
  schemaVersion: manifest.schemaVersion,
  baselineId: manifest.baselineId,
  postgres: manifest.postgres,
  sourceEvidence: manifest.sourceEvidence,
  roleBootstrap: immutableDescriptor(manifest.roleBootstrap),
  runtimeSecretBootstrap: immutableDescriptor(manifest.runtimeSecretBootstrap),
  legacySchemaAdoptions: manifest.legacySchemaAdoptions?.map(immutableDescriptor),
  schema: immutableDescriptor(manifest.schema),
  objectCatalog: immutableDescriptor(manifest.objectCatalog),
  coveredMigrations: manifest.coveredMigrations,
  installOrder: manifest.installOrder,
  upgradeProfiles: manifest.upgradeProfiles,
  excludedReleaseInputs: manifest.excludedReleaseInputs,
  contentGuarantees: manifest.contentGuarantees
})

export const computeBaselineFingerprint = (manifest) => sha256(
  Buffer.from(JSON.stringify(baselineFingerprintPayload(manifest)), 'utf8')
)
