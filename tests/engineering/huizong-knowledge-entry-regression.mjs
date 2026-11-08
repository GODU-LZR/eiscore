import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const dashboard = read('../../eiscore-apps/src/views/AppDashboard.vue')
const appRouter = read('../../eiscore-apps/src/router/index.js')
const knowledgeView = read('../../eiscore-apps/src/views/EnterpriseKnowledgeWorkbench.vue')
const authClient = read('../../eiscore-base/src/services/harness-auth-client.js')
const loginView = read('../../eiscore-base/src/views/LoginView.vue')

assert.match(dashboard, /key: 'enterprise-knowledge'[\s\S]*?name: '企业知识库'/)
assert.match(dashboard, /router\.push\('\/enterprise-knowledge'\)/)
assert.match(dashboard, /v-if="entry\.card\.metrics\?\.length"/)
assert.match(appRouter, /path: '\/enterprise-knowledge\/:appId\?'[\s\S]*?EnterpriseKnowledgeWorkbench\.vue/)
assert.match(knowledgeView, /src="\/harness-knowledge-embed\/#digital-twin"/)
assert.doesNotMatch(knowledgeView, /OntologyBrainGraph|ontology-relations|harness-embed\/#digital-twin/)
assert.match(knowledgeView, /authApiPrefix: KNOWLEDGE_HARNESS_AUTH_API_PREFIX/)
assert.match(authClient, /'\/harness-knowledge-embed-api'/)
assert.match(loginView, /'\/harness-knowledge-embed-api\/eiscore\/auth\/handoff'/)
assert.match(loginView, /refreshKnowledgeHarnessAuthState\(\)/)
assert.match(loginView, /\/apps\/enterprise-knowledge/)

console.log('PASS: Apps dashboard exposes isolated knowledge Harness and login callback')
