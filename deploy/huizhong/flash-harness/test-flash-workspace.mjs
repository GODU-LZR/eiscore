import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createFlashWorkspaceService } = require('./flash-workspace-service.js')
const parent = resolve(tmpdir())
const root = await mkdtemp(join(parent, 'huizong-flash-workspace-'))
const service = createFlashWorkspaceService({
  projectPath: 'src/views/drafts',
  workdirConfigured: root,
  draftFileName: 'FlashDraft.vue',
  moduleRoot: root,
  normalizeText: (value) => String(value || '').trim(),
  normalizeProjectPath: (value) => String(value).replaceAll('\\', '/'),
  sanitizePathToken: (value, fallback) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '') || fallback,
  FlashToolError: class extends Error {},
  logAgentEvent() {}
})
const appA = 'a1111111-1111-4111-8111-111111111111'
const appB = 'b2222222-2222-4222-8222-222222222222'
try {
  const empty = await service.readDraftSource(appA)
  assert.equal(empty.content, '')
  assert.equal(empty.bytes, 0)
  assert.equal(empty.path, `src/views/drafts/.app-drafts/${appA}.vue`)
  assert.equal((await service.readDraftSource()).content, '')
  assert.deepEqual(await readdir(root), [], 'Empty reads must not create files')

  await service.writeDraftSource('<template>App A</template>', '', null, appA)
  assert.equal((await service.readDraftSource(appA)).content, '<template>App A</template>')
  assert.equal((await service.readDraftSource()).content, '<template>App A</template>', 'Unscoped legacy reads retain preview behavior')
  assert.equal((await service.readDraftSource(appB)).content, '', 'New app must not inherit another app preview')

  await service.writeDraftSource('<template>App B</template>', '', null, appB)
  assert.equal((await service.readDraftSource(appB)).content, '<template>App B</template>')
  assert.equal((await service.readDraftSource(appA)).content, '<template>App A</template>')
  assert.equal((await service.readDraftSource()).content, '<template>App A</template>')
  assert.equal(await readFile(join(root, '.app-drafts', `${appB}.vue`), 'utf8'), '<template>App B</template>')
  console.log('PASS: empty workspace, independent app drafts and legacy preview reads')
} finally {
  assert.equal(dirname(resolve(root)), parent)
  assert.ok(basename(root).startsWith('huizong-flash-workspace-'))
  await rm(root, { recursive: true, force: true })
}
