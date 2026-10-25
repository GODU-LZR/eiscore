import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const page = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/EnterpriseKnowledgeWorkbench.vue'), 'utf8')

assert.equal((page.match(/<iframe\b/g) || []).length, 1, 'knowledge route must keep one native Harness iframe')
assert.match(page, /src="\/harness-knowledge-embed\/#digital-twin"/)
assert.match(page, /prepareBusinessHarnessAuth/)
assert.match(page, /KNOWLEDGE_HARNESS_AUTH_API_PREFIX = '\/harness-knowledge-embed-api'/)
assert.doesNotMatch(page, /KnowledgeFilesPanel|KnowledgeOntologyPanel/)
assert.doesNotMatch(page, /workspace-section|mobile-workspace-tabs|knowledge-files-panel|knowledge-ontology-panel/)
assert.doesNotMatch(page, /loadKnowledgeOntologyContext|uploadKnowledgeFile|updateKnowledgeFile/)

console.log('PASS: knowledge route leaves file and ontology surfaces inside native DeepSeekHardness')
