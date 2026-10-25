import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const page = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/EnterpriseKnowledgeWorkbench.vue'), 'utf8')
const files = readFileSync(resolve(repoRoot, 'eiscore-apps/src/components/KnowledgeFilesPanel.vue'), 'utf8')
const fileClient = readFileSync(resolve(repoRoot, 'eiscore-apps/src/services/knowledge-file-client.js'), 'utf8')
const ontology = readFileSync(resolve(repoRoot, 'eiscore-apps/src/components/KnowledgeOntologyPanel.vue'), 'utf8')
const ontologyClient = readFileSync(resolve(repoRoot, 'eiscore-apps/src/services/knowledge-ontology-client.js'), 'utf8')
const vite = readFileSync(resolve(repoRoot, 'eiscore-apps/vite.config.js'), 'utf8')
const nginx = readFileSync(resolve(repoRoot, 'deploy/huizhong/nginx/huizong.conf'), 'utf8')

for (const component of ['KnowledgeFilesPanel', 'KnowledgeOntologyPanel']) {
  assert.match(page, new RegExp(`import ${component} from ['"]@/components/${component}\\.vue['"]`))
}
assert.match(page, /workspace-section/)
assert.match(page, /src="\/harness-knowledge-embed\/#digital-twin"/)
assert.match(page, /prepareBusinessHarnessAuth/)
assert.match(page, /<KnowledgeFilesPanel[\s\S]*:selected-file="selectedKnowledgeFile"/)
assert.match(page, /const handleKnowledgeFileUpdate = \(file\) => \{[\s\S]*selectedKnowledgeFile\.value\?\.id !== file\.id/)
assert.match(page, /mobileView === 'files'/)
assert.match(page, /mobileView === 'ontology'/)
assert.match(page, /@media \(max-width: 960px\)/)

for (const expected of [
  '/harness-knowledge-agent/twin/knowledge/files',
  'uploadKnowledgeFile',
  'readKnowledgeFile',
  'updateKnowledgeFile',
  'deleteKnowledgeFile'
]) assert.match(`${files}\n${fileClient}`, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

assert.match(ontologyClient, /\/harness-knowledge-agent\/twin\/knowledge\/ontology\/context/)
assert.doesNotMatch(ontologyClient, /ontology_table_|v_ontology_|agent_ontology_/)
assert.match(ontology, /normalizeKnowledgeOntologyContext/)
assert.match(ontology, /namespace !== 'knowledge'/)
assert.match(ontology, /profile !== 'knowledge'/)
assert.match(ontology, /const file = props\.selectedFile[\s\S]*updateKnowledgeFile\(file\.id, patch\)/)
assert.match(ontology, /if \(props\.selectedFile\?\.id !== file\.id\) return/)
assert.match(files, /const requestId = \+\+selectionRequestId[\s\S]*requestId !== selectionRequestId \|\| selectedId\.value !== file\.id/)
assert.match(vite, /'\/harness-knowledge-agent': \{[\s\S]*target: devProxyTargets\.knowledgeAgent/)
assert.match(nginx, /location \^~ \/harness-knowledge-agent\/[\s\S]*proxy_pass http:\/\/knowledge-agent:8078\//)

console.log('PASS: knowledge workbench keeps file, native Harness, ontology and mobile panel contracts')
