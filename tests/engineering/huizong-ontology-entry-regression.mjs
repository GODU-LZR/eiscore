import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const dashboard = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppDashboard.vue'), 'utf8')
const router = readFileSync(resolve(repoRoot, 'eiscore-apps/src/router/index.js'), 'utf8')
const appMain = readFileSync(resolve(repoRoot, 'eiscore-apps/src/main.js'), 'utf8')

assert.match(dashboard, /key: 'ontology-workbench'[\s\S]*?name: '大脑本体知识库'/)
assert.match(dashboard, /desc: '查看业务实体、属性与关系语义'/)
assert.match(dashboard, /v-if="entry\.card\.metrics\?\.length" class="app-metrics"/)
assert.match(dashboard, /key: 'ontology-workbench'[\s\S]*?metrics: \[\]/)
assert.match(dashboard, /visible: canManage\.value[\s\S]*?isAppVisible\(displayVisibility\.value, 'apps', entry\.key\)/)
assert.match(dashboard, /entry\.key === 'ontology-workbench'[\s\S]*?router\.push\('\/ontology-relations'\)/)
assert.match(router, /path: '\/ontology-relations\/:appId\?'[\s\S]*?name: 'OntologyWorkbench'[\s\S]*?OntologyWorkbench\.vue/)
assert.match(router, /path: '\/ontology-relations\/:appId\?'[\s\S]*?requiresManage: true/)
assert.match(appMain, /to\.meta\?\.requiresManage && !canAccessAppCenterManage\(\)/)
assert.match(appMain, /hasPerm\('module:app'\) \|\| hasPerm\('module:apps'\)/)

console.log('PASS: Huizong ontology knowledge entry uses existing workbench route and manage/display gates')
