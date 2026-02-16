<template>
  <div class="ontology-workbench">
    <section class="wb-hero">
      <div class="hero-text">
        <h2>本体关系工作台</h2>
        <p>以业务友好的方式查看系统表关系、本体语义关系与影响范围。</p>
      </div>
      <div class="hero-actions">
        <el-tag effect="dark" type="info">已加载 {{ filteredRelations.length }} 条关系</el-tag>
        <el-button :loading="loading" type="primary" @click="reload">刷新数据</el-button>
        <el-button @click="goBack">返回应用中心</el-button>
      </div>
    </section>

    <section class="wb-layout">
      <aside class="wb-side">
        <el-card shadow="never" class="wb-card metrics-card">
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="metric-label">关系总数</div>
              <div class="metric-value">{{ filteredRelations.length }}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">表总数</div>
              <div class="metric-value">{{ allTables.length }}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">本体关系</div>
              <div class="metric-value">{{ ontologyCount }}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">外键关系</div>
              <div class="metric-value">{{ foreignKeyCount }}</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="wb-card table-card">
          <template #header>
            <div class="card-header">
              <span>表导航</span>
              <el-tag size="small">{{ allTables.length }}</el-tag>
            </div>
          </template>
          <el-input
            v-model="searchText"
            clearable
            placeholder="搜索表名（如 workflow）"
            class="table-search"
          />
          <el-scrollbar class="table-scroll">
            <button
              v-for="table in allTables"
              :key="table"
              type="button"
              class="table-item"
              :class="{ active: table === selectedTable }"
              @click="selectTable(table)"
            >
              {{ table }}
            </button>
          </el-scrollbar>
        </el-card>
      </aside>

      <main class="wb-main">
        <el-card shadow="never" class="wb-card relation-card">
          <template #header>
            <div class="card-header">
              <span>关系分析</span>
              <div class="header-controls">
                <el-select v-model="relationType" size="small" style="width: 140px">
                  <el-option label="全部类型" value="all" />
                  <el-option label="本体关系" value="ontology" />
                  <el-option label="外键关系" value="foreign_key" />
                </el-select>
                <el-tag type="success" effect="plain">当前表: {{ selectedTable || '未选择' }}</el-tag>
              </div>
            </div>
          </template>

          <div class="relation-stage">
            <section class="stage-column">
              <div class="stage-title">上游关系（指向当前表）</div>
              <el-scrollbar class="stage-scroll">
                <button
                  v-for="item in incomingRelations"
                  :key="`in-${item.id}`"
                  type="button"
                  class="relation-node"
                  :class="{ picked: pickedRelationId === item.id }"
                  @click="pickRelation(item)"
                >
                  <div class="node-main">{{ item.subject_table }}</div>
                  <div class="node-sub">{{ relationTypeLabel(item.relation_type) }} · {{ item.predicate }}</div>
                </button>
                <div v-if="incomingRelations.length === 0" class="stage-empty">暂无上游关系</div>
              </el-scrollbar>
            </section>

            <section class="stage-center">
              <div class="center-pill">当前表</div>
              <div class="center-table">{{ selectedTable || '请先从左侧选择一个表' }}</div>
              <div class="center-summary">
                <span>入 {{ incomingRelations.length }}</span>
                <span>出 {{ outgoingRelations.length }}</span>
              </div>
            </section>

            <section class="stage-column">
              <div class="stage-title">下游关系（当前表指向）</div>
              <el-scrollbar class="stage-scroll">
                <button
                  v-for="item in outgoingRelations"
                  :key="`out-${item.id}`"
                  type="button"
                  class="relation-node"
                  :class="{ picked: pickedRelationId === item.id }"
                  @click="pickRelation(item)"
                >
                  <div class="node-main">{{ item.object_table }}</div>
                  <div class="node-sub">{{ relationTypeLabel(item.relation_type) }} · {{ item.predicate }}</div>
                </button>
                <div v-if="outgoingRelations.length === 0" class="stage-empty">暂无下游关系</div>
              </el-scrollbar>
            </section>
          </div>

          <div class="relation-detail" v-if="pickedRelation">
            <div class="detail-title">关系详情</div>
            <div class="detail-grid">
              <div class="detail-item"><span>类型</span><strong>{{ relationTypeLabel(pickedRelation.relation_type) }}</strong></div>
              <div class="detail-item"><span>谓词</span><strong>{{ pickedRelation.predicate || '-' }}</strong></div>
              <div class="detail-item"><span>主体</span><strong>{{ pickedRelation.subject_table }}{{ formatColumn(pickedRelation.subject_column) }}</strong></div>
              <div class="detail-item"><span>客体</span><strong>{{ pickedRelation.object_table }}{{ formatColumn(pickedRelation.object_column) }}</strong></div>
              <div class="detail-item full"><span>桥接表</span><strong>{{ pickedRelation.bridge_table || '-' }}</strong></div>
              <div class="detail-item full"><span>说明</span><strong>{{ pickedRelation.details || '-' }}</strong></div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="wb-card list-card">
          <template #header>
            <div class="card-header">
              <span>关系明细列表</span>
              <el-tag type="info" effect="plain">更新时间 {{ refreshedAt }}</el-tag>
            </div>
          </template>
          <el-table :data="tableRows" size="small" border stripe height="280" @row-click="pickRelation">
            <el-table-column prop="relation_type" label="关系类型" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="row.relation_type === 'ontology' ? 'primary' : 'success'">
                  {{ relationTypeLabel(row.relation_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="subject_table" label="主体表" min-width="170" />
            <el-table-column prop="predicate" label="谓词" min-width="180" />
            <el-table-column prop="object_table" label="客体表" min-width="170" />
            <el-table-column prop="details" label="说明" min-width="260" show-overflow-tooltip />
          </el-table>
        </el-card>
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const router = useRouter()

const loading = ref(false)
const relations = ref([])
const searchText = ref('')
const relationType = ref('all')
const selectedTable = ref('')
const pickedRelationId = ref(null)
const refreshedAt = ref('-')

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

const incomingRelations = computed(() =>
  filteredRelations.value.filter((item) => item.object_table === selectedTable.value)
)

const outgoingRelations = computed(() =>
  filteredRelations.value.filter((item) => item.subject_table === selectedTable.value)
)

const ontologyCount = computed(() =>
  filteredRelations.value.filter((item) => item.relation_type === 'ontology').length
)

const foreignKeyCount = computed(() =>
  filteredRelations.value.filter((item) => item.relation_type === 'foreign_key').length
)

const pickedRelation = computed(() =>
  filteredRelations.value.find((item) => item.id === pickedRelationId.value) || null
)

const tableRows = computed(() => filteredRelations.value.slice(0, 400))

const relationTypeLabel = (value) => {
  if (value === 'ontology') return '本体关系'
  if (value === 'foreign_key') return '外键关系'
  return value || '-'
}

const formatColumn = (value) => (value ? `.${value}` : '')

const selectTable = (table) => {
  selectedTable.value = table || ''
  const first = outgoingRelations.value[0] || incomingRelations.value[0] || null
  pickedRelationId.value = first?.id || null
}

const pickRelation = (row) => {
  if (!row) return
  pickedRelationId.value = row.id
}

const syncSelectedTable = () => {
  if (!allTables.value.length) {
    selectedTable.value = ''
    pickedRelationId.value = null
    return
  }
  if (!selectedTable.value || !allTables.value.includes(selectedTable.value)) {
    selectedTable.value = allTables.value[0]
  }
  const list = outgoingRelations.value.length ? outgoingRelations.value : incomingRelations.value
  if (!list.some((item) => item.id === pickedRelationId.value)) {
    pickedRelationId.value = list[0]?.id || null
  }
}

const reload = async () => {
  loading.value = true
  try {
    const rows = await request({
      url: '/ontology_table_relations?select=id,relation_type,subject_table,subject_column,predicate,object_table,object_column,bridge_table,details&order=relation_type.asc,id.asc',
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

onMounted(() => {
  reload()
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

.wb-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
}

.wb-side,
.wb-main {
  min-width: 0;
}

.wb-card {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
}

.metrics-card {
  margin-bottom: 12px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.metric-item {
  padding: 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 50%, var(--el-fill-color-blank));
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
}

.table-search {
  margin-bottom: 10px;
}

.table-scroll {
  height: calc(100vh - 340px);
  min-height: 220px;
}

.table-item {
  width: 100%;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font: inherit;
  cursor: pointer;
  transition: all 0.16s ease;
}

.table-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary-light-9) 50%, var(--el-fill-color-blank));
}

.table-item.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary-dark-2);
  background: color-mix(in srgb, var(--el-color-primary-light-8) 46%, var(--el-fill-color-blank));
}

.relation-card {
  margin-bottom: 12px;
}

.relation-stage {
  display: grid;
  grid-template-columns: 1fr 260px 1fr;
  gap: 12px;
  align-items: stretch;
  min-height: 260px;
}

.stage-column {
  min-width: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  padding: 10px;
  background: var(--el-fill-color-extra-light);
}

.stage-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.stage-scroll {
  height: 220px;
}

.relation-node {
  width: 100%;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 8px;
  background: var(--el-fill-color-blank);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, transform 0.16s ease;
}

.relation-node:hover {
  border-color: var(--el-color-primary-light-5);
  transform: translateY(-1px);
}

.relation-node.picked {
  border-color: var(--el-color-primary);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}

.node-main {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.node-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stage-empty {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
  padding: 24px 0;
}

.stage-center {
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 28%, var(--el-border-color));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--el-color-primary-light-9) 66%, var(--el-fill-color-blank)),
      var(--el-fill-color-blank)
    );
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.center-pill {
  padding: 3px 10px;
  border-radius: 999px;
  color: var(--el-color-primary);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 45%, transparent);
  font-size: 12px;
}

.center-table {
  max-width: 100%;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  text-align: center;
  word-break: break-all;
}

.center-summary {
  display: flex;
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.relation-detail {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 10px;
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

@media (max-width: 1200px) {
  .wb-layout {
    grid-template-columns: 1fr;
  }

  .table-scroll {
    height: 220px;
  }
}

@media (max-width: 900px) {
  .wb-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .relation-stage {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
