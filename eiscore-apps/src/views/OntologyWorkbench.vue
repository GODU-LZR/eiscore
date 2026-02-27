<template>
  <div class="ontology-workbench">
    <section class="wb-hero">
      <div class="hero-text">
        <h2>本体关系工作台</h2>
        <p>以图关系方式查看系统表之间的本体语义关系与影响范围。</p>
      </div>
      <div class="hero-actions">
        <el-tag effect="dark" type="info">已加载 {{ filteredRelations.length }} 条关系</el-tag>
        <el-button :loading="loading" type="primary" @click="reload">刷新数据</el-button>
        <el-button @click="goBack">返回应用中心</el-button>
      </div>
    </section>

    <section class="wb-metric-row">
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">关系总数</div>
        <div class="metric-value">{{ filteredRelations.length }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">表总数</div>
        <div class="metric-value">{{ allTables.length }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">本体关系</div>
        <div class="metric-value">{{ ontologyCount }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">外键关系</div>
        <div class="metric-value">{{ foreignKeyCount }}</div>
      </el-card>
    </section>

    <section class="wb-layout">
      <main class="wb-main full">
        <el-card shadow="never" class="wb-card relation-card">
          <template #header>
            <div class="card-header">
              <span>图关系总览</span>
              <div class="header-controls">
                <el-select v-model="relationType" size="small" style="width: 140px">
                  <el-option label="全部类型" value="all" />
                  <el-option label="本体关系" value="ontology" />
                  <el-option label="外键关系" value="foreign_key" />
                </el-select>
                <el-tag type="success" effect="plain">
                  当前聚焦: {{ selectedTable ? tableDisplayLabel(selectedTable) : '全部表' }}
                </el-tag>
                <el-button size="small" text :disabled="!selectedTable" @click="clearTableFocus">
                  查看全部
                </el-button>
              </div>
            </div>
          </template>

          <div class="graph-toolbar">
            <el-input
              v-model="searchText"
              clearable
              class="graph-search"
              placeholder="筛选关系（表名/关系词/说明）"
            />
            <div class="graph-tip">点击表格图标可聚焦该表关系，再次点击可取消聚焦。</div>
            <div class="graph-zoom">
              <el-button size="small" @click="zoomOut">缩小</el-button>
              <el-slider
                v-model="graphZoom"
                :min="0.6"
                :max="1.8"
                :step="0.1"
                style="width: 130px"
              />
              <el-button size="small" @click="zoomIn">放大</el-button>
              <el-button size="small" text @click="resetZoom">100%</el-button>
            </div>
            <el-tag effect="plain">当前展示 {{ graphRelations.length }} 条关系</el-tag>
          </div>

          <div ref="graphHostRef" class="graph-host">
            <OntologyRelationGraph
              :relations="graphRelations"
              :selected-table="selectedTable"
              :picked-relation-id="pickedRelationId"
              :table-label-map="tableLabelMap"
              :predicate-label="predicateLabel"
              :host-width="graphHostWidth"
              :zoom="graphZoom"
              @toggle-table="toggleTableFocus"
              @pick-relation="pickRelation"
            />
          </div>

          <div class="relation-detail" v-if="pickedRelation">
            <div class="detail-title">关系详情</div>
            <div class="detail-grid">
              <div class="detail-item"><span>类型</span><strong>{{ relationTypeLabel(pickedRelation.relation_type) }}</strong></div>
              <div class="detail-item"><span>关系词</span><strong>{{ predicateLabel(pickedRelation.predicate) }}</strong></div>
              <div class="detail-item">
                <span>主体</span>
                <strong>{{ tableDisplayLabel(pickedRelation.subject_table) }}（{{ pickedRelation.subject_table }}{{ formatColumn(pickedRelation.subject_column) }}）</strong>
              </div>
              <div class="detail-item">
                <span>客体</span>
                <strong>{{ tableDisplayLabel(pickedRelation.object_table) }}（{{ pickedRelation.object_table }}{{ formatColumn(pickedRelation.object_column) }}）</strong>
              </div>
              <div class="detail-item full"><span>桥接表</span><strong>{{ pickedRelation.bridge_table || '-' }}</strong></div>
              <div class="detail-item full"><span>说明</span><strong>{{ pickedRelation.details || '-' }}</strong></div>
            </div>
          </div>

          <div class="column-semantic-panel">
            <div class="detail-title">列级语义</div>
            <div class="column-toolbar">
              <el-tag effect="plain" type="info">
                当前范围: {{ selectedTable ? tableDisplayLabel(selectedTable) : '未选中表（点击图中表节点）' }}
              </el-tag>
              <el-tag effect="plain">列语义 {{ currentColumnRows.length }} 条</el-tag>
              <el-button
                size="small"
                text
                :loading="columnSemanticsLoading"
                :disabled="columnTablesForDisplay.length === 0"
                @click="reloadColumnSemantics"
              >
                刷新列语义
              </el-button>
            </div>

            <div v-if="columnTablesForDisplay.length === 0" class="column-empty-tip">
              点击图中的表格节点后，可查看该表的列级语义（字段语义、敏感标记、语义来源等）。
            </div>

            <el-table
              v-else
              :data="currentColumnRows"
              size="small"
              border
              stripe
              :loading="columnSemanticsLoading"
              max-height="320"
            >
              <el-table-column label="所属表" min-width="170">
                <template #default="{ row }">
                  <div>{{ tableDisplayLabel(row.table_key) }}</div>
                  <div class="table-raw">{{ row.table_key }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="column_name" label="字段名" min-width="130" />
              <el-table-column prop="semantic_name" label="语义名" min-width="150" />
              <el-table-column prop="semantic_class" label="语义类型" min-width="120">
                <template #default="{ row }">{{ semanticClassLabel(row.semantic_class) }}</template>
              </el-table-column>
              <el-table-column prop="data_type" label="数据类型" width="110" />
              <el-table-column prop="ui_type" label="界面类型" width="110" />
              <el-table-column prop="semantics_mode" label="语义模式" width="120">
                <template #default="{ row }">{{ semanticsModeLabel(row.semantics_mode) }}</template>
              </el-table-column>
              <el-table-column prop="source" label="来源" width="110" />
              <el-table-column prop="is_sensitive" label="敏感" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.is_sensitive ? 'danger' : 'info'" effect="plain">
                    {{ row.is_sensitive ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>

        <el-card shadow="never" class="wb-card list-card">
          <template #header>
            <div class="card-header">
              <span>关系明细列表</span>
              <div class="header-controls">
                <el-tag type="info" effect="plain">更新时间 {{ refreshedAt }}</el-tag>
                <el-button size="small" text @click="toggleListPanel">
                  {{ listPanelExpanded ? '收起列表' : '展开列表' }}
                </el-button>
              </div>
            </div>
          </template>
          <div v-if="!listPanelExpanded" class="list-collapsed-tip">
            明细列表已收起，可点击“展开列表”查看关系明细。
          </div>
          <el-table
            v-else
            :data="tableRows"
            size="small"
            border
            stripe
            height="280"
            @row-click="pickRelation"
          >
            <el-table-column prop="relation_type" label="关系类型" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="row.relation_type === 'ontology' ? 'primary' : 'success'">
                  {{ relationTypeLabel(row.relation_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="subject_table" label="主体表" min-width="180">
              <template #default="{ row }">
                <div>{{ tableDisplayLabel(row.subject_table) }}</div>
                <div class="table-raw">{{ row.subject_table }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="predicate" label="关系词" min-width="180">
              <template #default="{ row }">{{ predicateLabel(row.predicate) }}</template>
            </el-table-column>
            <el-table-column prop="object_table" label="客体表" min-width="180">
              <template #default="{ row }">
                <div>{{ tableDisplayLabel(row.object_table) }}</div>
                <div class="table-raw">{{ row.object_table }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="details" label="说明" min-width="260" show-overflow-tooltip />
          </el-table>
        </el-card>
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import OntologyRelationGraph from '@/components/OntologyRelationGraph.vue'

const router = useRouter()

const loading = ref(false)
const relations = ref([])
const searchText = ref('')
const relationType = ref('ontology')
const selectedTable = ref('')
const pickedRelationId = ref(null)
const refreshedAt = ref('-')
const graphHostRef = ref(null)
const graphHostWidth = ref(1000)
const listPanelExpanded = ref(false)
const graphZoom = ref(1)
const columnSemanticsLoading = ref(false)
const columnSemanticsCache = ref({})
let graphResizeObserver = null

const STATIC_TABLE_LABELS = {
  'public.users': '用户',
  'public.roles': '角色',
  'public.permissions': '权限点',
  'public.user_roles': '用户角色关系',
  'public.role_permissions': '角色权限关系',
  'public.v_permission_ontology': '权限语义视图',
  'workflow.definitions': '流程定义',
  'workflow.instances': '流程实例',
  'workflow.task_assignments': '任务分派',
  'app_center.apps': '应用中心应用',
  'app_center.workflow_state_mappings': '流程状态映射'
}

const PREDICATE_LABELS = {
  'acl:hasRole': '拥有角色',
  'acl:grantsPermission': '授予权限',
  'wf:instanceOf': '实例属于流程定义',
  'wf:hasCurrentTask': '实例当前任务',
  'wf:assignedRole': '任务分配给角色',
  'wf:assignedUser': '任务分配给用户',
  'wf:mapsToStatus': '流程节点映射业务状态',
  'eiscore:linkedApp': '流程关联应用',
  'ontology:semanticProjection': '权限语义投影',
  'ontology:dependsOn': '业务依赖关系'
}

const SEMANTIC_CLASS_LABELS = {
  business_attribute: '业务属性',
  enum_attribute: '枚举属性',
  hierarchy_attribute: '层级属性',
  geo_attribute: '地理属性',
  file_attribute: '文件属性',
  derived_metric: '派生指标'
}

const normalizedSearch = computed(() => String(searchText.value || '').trim().toLowerCase())

const filteredRelations = computed(() => {
  const keyword = normalizedSearch.value
  return relations.value.filter((item) => {
    const typePass = relationType.value === 'all' || item.relation_type === relationType.value
    if (!typePass) return false
    if (!keyword) return true
    const haystack = [
      item.subject_table,
      item.subject_column,
      item.predicate,
      item.object_table,
      item.object_column,
      item.subject_semantic_name,
      item.object_semantic_name,
      item.bridge_table,
      item.details
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const allTables = computed(() => {
  const set = new Set()
  filteredRelations.value.forEach((item) => {
    if (item.subject_table) set.add(item.subject_table)
    if (item.object_table) set.add(item.object_table)
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const graphRelations = computed(() => {
  if (!selectedTable.value) return filteredRelations.value
  return filteredRelations.value.filter((item) =>
    item.subject_table === selectedTable.value || item.object_table === selectedTable.value
  )
})

const ontologyCount = computed(() =>
  filteredRelations.value.filter((item) => item.relation_type === 'ontology').length
)

const foreignKeyCount = computed(() =>
  filteredRelations.value.filter((item) => item.relation_type === 'foreign_key').length
)

const pickedRelation = computed(() =>
  graphRelations.value.find((item) => item.id === pickedRelationId.value) || null
)

const tableRows = computed(() => graphRelations.value.slice(0, 500))

const columnTablesForDisplay = computed(() => {
  if (selectedTable.value) return [selectedTable.value]
  if (!pickedRelation.value) return []
  const list = [pickedRelation.value.subject_table, pickedRelation.value.object_table]
  return Array.from(new Set(list.filter(Boolean)))
})

const currentColumnRows = computed(() => {
  return columnTablesForDisplay.value.flatMap((tableKey) => {
    const rows = columnSemanticsCache.value[tableKey] || []
    return rows.map((row) => ({ ...row, table_key: tableKey }))
  })
})

const relationTypeLabel = (value) => {
  if (value === 'ontology') return '本体关系'
  if (value === 'foreign_key') return '外键关系'
  return value || '-'
}

const semanticClassLabel = (value) => SEMANTIC_CLASS_LABELS[value] || value || '-'

const semanticsModeLabel = (value) => {
  if (value === 'ai_defined') return 'AI定义'
  if (value === 'creator_defined') return '创建者定义'
  if (value === 'none') return '无语义'
  return value || '-'
}

const predicateLabel = (value) => PREDICATE_LABELS[value] || value || '-'

const formatColumn = (value) => (value ? `.${value}` : '')

const sanitizeSemanticName = (value, fallback) => {
  const name = String(value || '').trim()
  if (!name || name === fallback) return ''
  if (name.includes('?')) return ''
  return name
}

const tableLabelMap = computed(() => {
  const map = { ...STATIC_TABLE_LABELS }
  filteredRelations.value.forEach((item) => {
    if (item.subject_table) {
      const semantic = sanitizeSemanticName(item.subject_semantic_name, item.subject_table)
      if (semantic) map[item.subject_table] = semantic
    }
    if (item.object_table) {
      const semantic = sanitizeSemanticName(item.object_semantic_name, item.object_table)
      if (semantic) map[item.object_table] = semantic
    }
  })
  return map
})

const tableDisplayLabel = (table) => tableLabelMap.value[table] || table

const parseTableKey = (tableKey) => {
  const value = String(tableKey || '').trim()
  if (!value) return null
  const chunks = value.split('.')
  if (chunks.length === 1) return { schema: 'public', table: chunks[0], tableKey: `public.${chunks[0]}` }
  const schema = chunks[0]
  const table = chunks.slice(1).join('.')
  return { schema, table, tableKey: `${schema}.${table}` }
}

const extractSemanticsMode = (tags) => {
  if (!Array.isArray(tags)) return ''
  const hit = tags.find((item) => String(item || '').startsWith('semantics:'))
  if (!hit) return ''
  return String(hit).slice('semantics:'.length)
}

const fetchColumnSemanticsByTable = async (tableKey) => {
  const parsed = parseTableKey(tableKey)
  if (!parsed) return []
  const schema = encodeURIComponent(parsed.schema)
  const table = encodeURIComponent(parsed.table)
  const rows = await request({
    url: `/ontology_column_semantics?select=table_schema,table_name,column_name,semantic_class,semantic_name,data_type,ui_type,is_sensitive,source,tags,is_active&table_schema=eq.${schema}&table_name=eq.${table}&is_active=is.true&order=column_name.asc`,
    method: 'get',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    }
  })
  if (!Array.isArray(rows)) return []
  return rows.map((item) => ({
    ...item,
    table_key: `${item.table_schema}.${item.table_name}`,
    semantics_mode: extractSemanticsMode(item.tags)
  }))
}

const ensureColumnSemanticsLoaded = async (tableKeys, force = false) => {
  const targets = Array.from(new Set((tableKeys || []).filter(Boolean))).filter((key) =>
    force || !Array.isArray(columnSemanticsCache.value[key])
  )
  if (!targets.length) return
  columnSemanticsLoading.value = true
  try {
    const list = await Promise.all(targets.map((key) => fetchColumnSemanticsByTable(key)))
    const next = { ...columnSemanticsCache.value }
    targets.forEach((key, index) => {
      next[key] = list[index]
    })
    columnSemanticsCache.value = next
  } catch {
    ElMessage.error('加载列语义失败')
  } finally {
    columnSemanticsLoading.value = false
  }
}

const reloadColumnSemantics = async () => {
  if (!columnTablesForDisplay.value.length) return
  const next = { ...columnSemanticsCache.value }
  columnTablesForDisplay.value.forEach((key) => {
    delete next[key]
  })
  columnSemanticsCache.value = next
  await ensureColumnSemanticsLoaded(columnTablesForDisplay.value, true)
}

const toggleTableFocus = (table) => {
  if (!table) {
    selectedTable.value = ''
    syncPickedRelation()
    return
  }
  selectedTable.value = selectedTable.value === table ? '' : table
  syncPickedRelation()
}

const clearTableFocus = () => {
  selectedTable.value = ''
  syncPickedRelation()
}

const toggleListPanel = () => {
  listPanelExpanded.value = !listPanelExpanded.value
  nextTick(() => updateGraphHostWidth())
}

const zoomIn = () => {
  graphZoom.value = Math.min(1.8, Number((graphZoom.value + 0.1).toFixed(1)))
}

const zoomOut = () => {
  graphZoom.value = Math.max(0.6, Number((graphZoom.value - 0.1).toFixed(1)))
}

const resetZoom = () => {
  graphZoom.value = 1
}

const pickRelation = (row) => {
  if (!row) return
  pickedRelationId.value = row.id
  if (
    selectedTable.value &&
    row.subject_table !== selectedTable.value &&
    row.object_table !== selectedTable.value
  ) {
    selectedTable.value = ''
  }
}

const syncPickedRelation = () => {
  if (!graphRelations.value.some((item) => item.id === pickedRelationId.value)) {
    pickedRelationId.value = null
  }
}

const syncSelectedTable = () => {
  if (!allTables.value.length) {
    selectedTable.value = ''
    pickedRelationId.value = null
    return
  }
  if (selectedTable.value && !allTables.value.includes(selectedTable.value)) {
    selectedTable.value = ''
  }
  syncPickedRelation()
}

const updateGraphHostWidth = () => {
  const width = graphHostRef.value?.clientWidth || 1000
  graphHostWidth.value = Math.max(860, width - 6)
}

const bindGraphResizeObserver = () => {
  updateGraphHostWidth()
  if (typeof ResizeObserver === 'undefined' || !graphHostRef.value) return
  graphResizeObserver = new ResizeObserver(() => {
    updateGraphHostWidth()
  })
  graphResizeObserver.observe(graphHostRef.value)
}

const reload = async () => {
  loading.value = true
  try {
    const rows = await request({
      url: '/ontology_table_relations?select=id,relation_type,subject_table,subject_column,predicate,object_table,object_column,bridge_table,details,subject_semantic_name,object_semantic_name&order=relation_type.asc,id.asc',
      method: 'get',
      headers: {
        'Accept-Profile': 'app_data',
        'Content-Profile': 'app_data'
      }
    })
    relations.value = Array.isArray(rows) ? rows : []
    refreshedAt.value = new Date().toLocaleTimeString()
    syncSelectedTable()
  } catch (error) {
    ElMessage.error('加载关系数据失败')
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/')
}

watch(filteredRelations, () => {
  syncSelectedTable()
})

watch(columnTablesForDisplay, (tables) => {
  ensureColumnSemanticsLoaded(tables)
}, { immediate: true })

onMounted(() => {
  reload()
  nextTick(() => bindGraphResizeObserver())
})

onBeforeUnmount(() => {
  if (graphResizeObserver) {
    graphResizeObserver.disconnect()
    graphResizeObserver = null
  }
})
</script>

<style scoped>
.ontology-workbench {
  min-height: 100vh;
  padding: 18px;
  background:
    radial-gradient(1200px 420px at -10% -20%, color-mix(in srgb, var(--el-color-primary) 16%, transparent), transparent 60%),
    radial-gradient(900px 380px at 110% -30%, color-mix(in srgb, var(--el-color-success) 14%, transparent), transparent 58%),
    var(--el-bg-color-page);
}

.wb-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--el-color-primary) 14%, var(--el-bg-color)),
    color-mix(in srgb, var(--el-color-primary-light-8) 40%, var(--el-bg-color))
  );
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
}

.hero-text h2 {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.hero-text p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.wb-metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.wb-layout {
  display: block;
}

.wb-main.full {
  min-width: 0;
}

.wb-card {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
}

.metric-line-item {
  padding: 10px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 60%, var(--el-fill-color-blank));
}

.metric-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-value {
  margin-top: 6px;
  color: var(--el-text-color-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.relation-card {
  margin-bottom: 12px;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 52%, var(--el-fill-color-blank));
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, var(--el-border-color));
}

.graph-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.graph-search {
  width: min(420px, 100%);
}

.graph-zoom {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-fill-color-blank) 84%, var(--el-color-primary-light-9));
  border: 1px solid var(--el-border-color-light);
}

.graph-host {
  min-height: clamp(520px, 66vh, 900px);
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 8px;
}

.relation-detail {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 10px;
}

.column-semantic-panel {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 10px;
}

.column-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.column-empty-tip {
  padding: 14px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.detail-item {
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  padding: 8px;
}

.detail-item span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 4px;
}

.detail-item strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}

.detail-item.full {
  grid-column: 1 / -1;
}

.list-card :deep(.el-card__body) {
  padding-top: 10px;
}

.table-raw {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-top: 2px;
}

.list-collapsed-tip {
  padding: 14px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

@media (max-width: 1200px) {
  .wb-metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .wb-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .wb-metric-row {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
