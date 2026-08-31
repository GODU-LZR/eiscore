// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { FlashToolError } = require('../../realtime/flash-postgrest-adapter')
const { createFlashWorkspaceService } = require('../../realtime/flash-workspace-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const sanitizePathToken = (value, fallback = 'default') => {
  const raw = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
  return (raw || fallback).slice(0, 64)
}
const normalizeProjectPath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\.\/+/, '')
const audits = []
const fixedNow = Date.parse('2026-08-31T12:34:56.000Z')
const tempRoot = mkdtempSync(join(tmpdir(), 'eiscore-flash-workspace-'))
const workdir = join(tempRoot, 'drafts')

const createService = (overrides = {}) => createFlashWorkspaceService({
  projectPath: 'eiscore-apps/src/views/drafts',
  workdirConfigured: workdir,
  draftFileName: 'FlashDraft.vue',
  attachmentDirName: '.uploads',
  attachmentMaxBytes: 32,
  attachmentPreviewMaxChars: 5,
  moduleRoot: join(tempRoot, 'realtime'),
  normalizeText: (value) => String(value || '').trim(),
  normalizeProjectPath,
  sanitizePathToken,
  FlashToolError,
  logAgentEvent: (type, user, details) => audits.push({ type, user, details }),
  getCwd: () => tempRoot,
  now: () => fixedNow,
  random: () => 0.5,
  ...overrides
})

try {
  const service = createService()
  assert.equal(Object.isFrozen(service), true)
  assert.equal(service.resolveWorkdir(), workdir)
  assert.equal(service.normalizeAppId(' app/one '), 'app_one')
  assert.equal(service.resolveDraftFilePath(), join(workdir, 'FlashDraft.vue'))
  assert.equal(service.resolveScopedDraftFilePath(' app/one '), join(workdir, '.app-drafts', 'app_one.vue'))
  assert.equal(service.resolveScopedDraftFilePath(''), '')
  assert.equal(await service.syncScopedDraftToPreview('missing'), false)
  assert.equal(await service.syncPreviewDraftToScoped(''), false)

  const user = { id: 'u-1', role: 'admin' }
  const written = await service.writeDraftSource(' <template>初版</template> ', '  initial draft  ', user, 'app/one')
  assert.deepEqual(written, {
    appId: 'app_one',
    activeAppId: 'app_one',
    path: 'eiscore-apps/src/views/drafts/FlashDraft.vue',
    scopedPath: 'eiscore-apps/src/views/drafts/.app-drafts/app_one.vue',
    bytes: Buffer.byteLength(' <template>初版</template> ', 'utf8')
  })
  assert.equal(readFileSync(join(workdir, 'FlashDraft.vue'), 'utf8'), ' <template>初版</template> ')
  assert.equal(readFileSync(join(workdir, '.app-drafts', 'app_one.vue'), 'utf8'), ' <template>初版</template> ')
  assert.deepEqual(audits[0], {
    type: 'flash:draft_write',
    user,
    details: { bytes: written.bytes, appId: 'app_one', reason: 'initial draft' }
  })

  writeFileSync(join(workdir, '.app-drafts', 'app_one.vue'), '<template>scoped</template>', 'utf8')
  const read = await service.readDraftSource('app/one')
  assert.equal(read.content, '<template>scoped</template>')
  assert.equal(read.activeAppId, 'app_one')
  assert.equal(read.path, 'eiscore-apps/src/views/drafts/.app-drafts/app_one.vue')
  assert.equal(readFileSync(join(workdir, 'FlashDraft.vue'), 'utf8'), '<template>scoped</template>')

  const fingerprintsBefore = await service.readDraftFingerprintsSafe('app/one')
  assert.equal(fingerprintsBefore.preview.sha1, fingerprintsBefore.scoped.sha1)
  assert.equal(fingerprintsBefore.preview.bytes, Buffer.byteLength('<template>scoped</template>'))
  assert.equal(fingerprintsBefore.preview.appId, 'app_one')
  writeFileSync(join(workdir, 'FlashDraft.vue'), '<template>preview changed</template>', 'utf8')
  const fingerprintsAfter = await service.readDraftFingerprintsSafe('app/one')
  assert.equal(service.hasFingerprintChanged(fingerprintsBefore.preview, fingerprintsAfter.preview), true)
  assert.equal(service.hasFingerprintChanged(fingerprintsBefore.scoped, fingerprintsAfter.scoped), false)
  assert.equal(service.hasFingerprintChanged(null, fingerprintsAfter.preview), true)
  assert.equal(service.hasFingerprintChanged(fingerprintsAfter.preview, null), false)
  assert.equal(await service.syncPreviewDraftToScoped('app/one'), true)
  assert.equal(readFileSync(join(workdir, '.app-drafts', 'app_one.vue'), 'utf8'), '<template>preview changed</template>')
  assert.equal((await service.readDraftFingerprintSafe('app/one')).sha1, fingerprintsAfter.preview.sha1)

  assert.equal(service.requireNonEmptyText('  value  ', 'name'), 'value')
  assert.throws(
    () => service.requireNonEmptyText(' ', 'name'),
    (error) => error instanceof FlashToolError && error.code === 'VALIDATION_FAILED' && error.httpStatus === 400
  )
  await assert.rejects(
    service.writeDraftSource('', '', null),
    (error) => error instanceof FlashToolError && error.message === 'content is required'
  )
  await assert.rejects(
    service.writeDraftSource('x'.repeat(1024 * 1024 + 1), '', null),
    (error) => error instanceof FlashToolError && error.message === 'content exceeds 1MB limit'
  )

  const textBody = {
    appId: 'app/one',
    conversationId: 'conv one',
    fileName: '../report ?.txt',
    mimeType: ' text/plain ',
    contentBase64: `data:text/plain;base64,${Buffer.from('hello world').toString('base64')}`
  }
  const firstAttachment = await service.uploadAttachment(textBody, user)
  assert.deepEqual(firstAttachment, {
    id: `att-${fixedNow}-8`,
    appId: 'app_one',
    conversationId: 'conv_one',
    name: 'report__.txt',
    mimeType: 'text/plain',
    size: 11,
    relativePath: '.uploads/app_one/conv_one/report__.txt',
    textPreview: 'hello',
    uploadedAt: '2026-08-31T12:34:56.000Z'
  })
  assert.equal(readFileSync(join(workdir, firstAttachment.relativePath), 'utf8'), 'hello world')
  const duplicateAttachment = await service.uploadAttachment(textBody, user)
  assert.equal(duplicateAttachment.name, 'report__-1.txt')
  assert.equal(duplicateAttachment.relativePath, '.uploads/app_one/conv_one/report__-1.txt')

  const binaryAttachment = await service.uploadAttachment({
    fileName: 'photo.png',
    contentType: 'image/png',
    base64: Buffer.from([0, 1, 2]).toString('base64')
  })
  assert.equal(binaryAttachment.appId, 'app')
  assert.equal(binaryAttachment.conversationId, 'default')
  assert.equal(binaryAttachment.textPreview, '')
  assert.equal(binaryAttachment.mimeType, 'image/png')
  assert.deepEqual(audits.slice(1).map((item) => item.type), [
    'flash:attachment_upload',
    'flash:attachment_upload'
  ])
  assert.equal(audits[1].details.name, 'report__.txt')

  await assert.rejects(
    service.uploadAttachment({ fileName: 'empty.txt', contentBase64: '' }),
    (error) => error instanceof FlashToolError && error.message === 'contentBase64 is required'
  )
  await assert.rejects(
    service.uploadAttachment({ fileName: 'large.bin', contentBase64: Buffer.alloc(33, 1).toString('base64') }),
    (error) => error instanceof FlashToolError && error.message === 'attachment exceeds 32 bytes'
  )

  const unsafeDraftService = createService({ draftFileName: '../outside.vue' })
  assert.throws(() => unsafeDraftService.resolveDraftFilePath(), /Flash draft path escapes workdir/)
  const unsafeAttachmentService = createService({ attachmentDirName: '../outside' })
  assert.throws(
    () => unsafeAttachmentService.buildSafeUploadPath(workdir, 'app', 'conv', 'file.txt'),
    /Attachment target escapes task workdir/
  )

  const missingConfigured = join(tempRoot, 'missing-configured')
  const fallbackService = createService({
    workdirConfigured: missingConfigured,
    projectPath: 'drafts'
  })
  assert.equal(fallbackService.resolveWorkdir(), workdir)

  const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
  assert.match(indexSource, /createFlashWorkspaceService\(\{/)
  assert.equal(indexSource.includes("require('fs')"), false)
  assert.equal(indexSource.includes("require('crypto')"), false)
  for (const forbidden of [
    'Flash draft path escapes workdir',
    'Attachment target escapes task workdir',
    "path.resolve(workdir, '.app-drafts')",
    'function sanitizeUploadFileName',
    'fs.promises.writeFile',
    "crypto.createHash('sha1')"
  ]) {
    assert.equal(indexSource.includes(forbidden), false, `composition root reintroduced ${forbidden}`)
  }
  assert.ok(indexSource.split(/\r?\n/).length <= 800, 'Realtime composition root exceeded 800-line exit gate')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

console.log('Flash workspace service regression passed')
