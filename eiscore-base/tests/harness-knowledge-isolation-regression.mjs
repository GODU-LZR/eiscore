import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const view = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/EnterpriseKnowledgeWorkbench.vue'), 'utf8')
const auth = readFileSync(resolve(repoRoot, 'eiscore-base/src/services/harness-auth-client.js'), 'utf8')
const login = readFileSync(resolve(repoRoot, 'eiscore-base/src/views/LoginView.vue'), 'utf8')

assert.match(view, /src="\/harness-knowledge-embed\/#digital-twin"/)
assert.equal((view.match(/<iframe\b/g) || []).length, 1, 'knowledge workbench must keep exactly one Harness iframe')
assert.doesNotMatch(view, /OntologyBrainGraph|brain-section|loadRelations|ONTOLOGY_RELATIONS_REQUEST/)
assert.match(view, /KNOWLEDGE_HARNESS_AUTH_API_PREFIX = '\/harness-knowledge-embed-api'/)
assert.doesNotMatch(view, /harness-entry|business-entry|x-eis-business-entry/)
assert.doesNotMatch(view, /harnessFrame|harnessLoading|handleHarnessLoad/)
assert.match(auth, /'\/harness-knowledge-embed-api'/)
assert.match(login, /'\/harness-knowledge-embed-api\/eiscore\/auth\/handoff'/)
assert.match(login, /returnPath\.startsWith\('\/harness-knowledge-embed-api\/'\)[\s\S]*?\/harness-knowledge-embed\/#digital-twin/)
const compose = readFileSync(resolve(repoRoot, 'deploy/huizhong/compose.knowledge.yml'), 'utf8')
assert.match(compose, /knowledge-web:[\s\S]*?knowledge_web_home:\/var\/lib\/dsh/)
assert.match(compose, /knowledge-harness-bridge:[\s\S]*?knowledge_bridge_home:\/var\/lib\/dsh/)

console.log('PASS: knowledge Harness uses isolated iframe/API entry and DSH state volumes')
