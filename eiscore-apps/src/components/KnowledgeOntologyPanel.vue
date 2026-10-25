<template>
  <aside class="knowledge-ontology-panel" aria-label="本体知识库">
    <div class="panel-heading">
      <div>
        <p class="panel-kicker">本体知识库</p>
        <h2>本体导航</h2>
      </div>
      <el-button class="icon-button" :loading="loading" title="刷新本体" aria-label="刷新本体" @click="loadContext">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <div class="panel-toolbar">
      <el-input v-model="query" clearable size="small" placeholder="搜索本体节点" aria-label="搜索本体节点" />
    </div>

    <div v-if="error" class="panel-error" role="alert">{{ error }}</div>
    <div v-if="loading && !tree.length" class="panel-empty">正在加载本体…</div>
    <div v-else-if="!filteredTree.length" class="panel-empty">暂无可见本体</div>
    <el-tree
      v-else
      class="ontology-tree"
      :data="filteredTree"
      node-key="id"
      :props="treeProps"
      :default-expand-all="!query"
      :expand-on-click-node="false"
      @node-click="selectNode"
    >
      <template #default="{ data }">
        <span class="tree-node">
          <el-icon><Grid v-if="data.type === 'table' || data.type === 'column'" /><Collection v-else /></el-icon>
          <span class="tree-label">{{ data.label }}</span>
          <small>{{ typeLabel(data.type) }}</small>
        </span>
      </template>
    </el-tree>

    <section v-if="selectedNode" class="selection-detail" aria-label="选中本体节点关系">
      <h3>{{ selectedNode.label }}</h3>
      <div class="node-meta">
        <span>{{ typeLabel(selectedNode.type) }}</span>
        <span v-if="selectedNode.metadata?.description">{{ selectedNode.metadata.description }}</span>
      </div>
      <div class="link-action">
        <el-button
          v-if="props.selectedFile"
          size="small"
          type="primary"
          plain
          :loading="linkLoading"
          :disabled="!props.selectedFile.id"
          @click="toggleSelectedFileLink"
        >
          <el-icon><Connection /></el-icon>
          {{ selectedNodeLinked ? '取消关联当前文件' : '关联当前文件' }}
        </el-button>
        <span v-else class="link-hint">选中文件后可建立关联</span>
      </div>
      <div v-if="selectedEdges.length" class="relation-list">
        <div v-for="item in selectedEdges" :key="item.id" class="relation-row">
          <span>{{ item.direction === 'out' ? '指向' : '来自' }}</span>
          <strong>{{ item.label || typeLabel(item.type) }}</strong>
          <small>{{ item.otherLabel }}</small>
        </div>
      </div>
      <p v-else class="no-relations">暂无关联关系</p>
    </section>

    <section v-if="props.selectedFile" class="selected-file" aria-label="当前文件">
      <span>当前文件</span>
      <strong>{{ props.selectedFile.file_name || props.selectedFile.name || '未命名文件' }}</strong>
      <div v-if="fileLinks.length" class="file-links">
        <span v-for="link in fileLinks" :key="link.id" class="file-link">{{ link.label }}</span>
      </div>
      <small v-else>尚未关联本体节点</small>
    </section>

    <div class="panel-footer" aria-live="polite">
      <span>{{ context.nodes.length }} 个节点</span>
      <span>{{ context.edges.length }} 条关系</span>
      <span v-if="selectedNode">已选：{{ selectedNode.label }}</span>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Collection, Connection, Grid, Refresh } from '@element-plus/icons-vue'
import { loadKnowledgeOntologyContext } from '@/services/knowledge-ontology-client'
import { updateKnowledgeFile } from '@/services/knowledge-file-client'
import {
  buildKnowledgeOntologyTree,
  buildKnowledgeFileMetadataPatch,
  filterKnowledgeOntologyTree,
  getKnowledgeOntologyLinks,
  normalizeKnowledgeOntologyContext,
  toggleKnowledgeOntologyLink
} from '@/domain/knowledge-ontology-policy'

const props = defineProps({
  selectedFile: { type: Object, default: null }
})
const emit = defineEmits(['select-node', 'file-updated'])

const loading = ref(false)
const error = ref('')
const query = ref('')
const linkLoading = ref(false)
const context = ref(normalizeKnowledgeOntologyContext(null))
const selectedNode = ref(null)
const treeProps = { label: 'label', children: 'children' }
const tree = computed(() => buildKnowledgeOntologyTree(context.value))
const filteredTree = computed(() => filterKnowledgeOntologyTree(tree.value, query.value))
const selectedEdges = computed(() => {
  if (!selectedNode.value) return []
  const nodeMap = new Map(context.value.nodes.map((node) => [node.id, node]))
  return context.value.edges.flatMap((edge) => {
    if (edge.source === selectedNode.value.id) {
      return [{ ...edge, direction: 'out', otherLabel: nodeMap.get(edge.target)?.label || edge.target }]
    }
    if (edge.target === selectedNode.value.id) {
      return [{ ...edge, direction: 'in', otherLabel: nodeMap.get(edge.source)?.label || edge.source }]
    }
    return []
  })
})
const fileLinks = computed(() => getKnowledgeOntologyLinks(props.selectedFile))
const selectedNodeLinked = computed(() => Boolean(selectedNode.value && fileLinks.value.some((item) => item.id === selectedNode.value.id)))

const typeLabel = (type) => ({ app: '应用', table: '表', column: '字段' }[type] || '节点')

const loadContext = async () => {
  loading.value = true
  error.value = ''
  try {
    const next = normalizeKnowledgeOntologyContext(await loadKnowledgeOntologyContext())
    if (next.meta.namespace !== 'knowledge' || next.meta.profile !== 'knowledge' || next.meta.readOnly !== true) {
      throw new Error('本体知识空间不匹配')
    }
    context.value = next
  } catch (cause) {
    error.value = cause?.message || '本体知识加载失败'
  } finally {
    loading.value = false
  }
}

const selectNode = (node) => {
  selectedNode.value = node
  emit('select-node', node)
}

const toggleSelectedFileLink = async () => {
  const file = props.selectedFile
  const node = selectedNode.value
  if (!file?.id || !node || linkLoading.value) return
  linkLoading.value = true
  error.value = ''
  try {
    const links = toggleKnowledgeOntologyLink(getKnowledgeOntologyLinks(file), node)
    const patch = buildKnowledgeFileMetadataPatch(links)
    const result = await updateKnowledgeFile(file.id, patch)
    if (props.selectedFile?.id !== file.id) return
    emit('file-updated', result?.file || {
      ...file,
      metadata: { ...file.metadata, ...patch.metadataPatch }
    })
  } catch (cause) {
    error.value = cause?.message || '本体关联更新失败'
  } finally {
    linkLoading.value = false
  }
}

onMounted(loadContext)
</script>

<style scoped>
.knowledge-ontology-panel { display: flex; min-width: 0; flex-direction: column; height: 100%; color: #253b42; background: #fff; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 14px 14px 10px; border-bottom: 1px solid #e5ecee; }
.panel-kicker { margin: 0 0 3px; color: #14766e; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
h2 { margin: 0; font-size: 16px; }
.icon-button { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; padding: 0; border: 1px solid #d6e2e4; border-radius: 4px; color: #46636b; background: #fff; cursor: pointer; }
.panel-toolbar { padding: 10px 12px; border-bottom: 1px solid #eef2f3; }
.ontology-tree { flex: 1; min-height: 120px; overflow: auto; padding: 6px; }
.tree-node { display: flex; min-width: 0; align-items: center; gap: 6px; width: 100%; }
.tree-node > .el-icon { flex: 0 0 auto; color: #2f8a82; }
.tree-label { min-width: 0; overflow: hidden; flex: 1; text-overflow: ellipsis; white-space: nowrap; }
.tree-node small { color: #8a999d; font-size: 10px; }
.panel-empty { display: grid; min-height: 120px; place-items: center; padding: 16px; color: #86979c; font-size: 12px; text-align: center; }
.panel-error { margin: 8px 10px; padding: 8px; border: 1px solid #f0c6c6; color: #a63d3d; background: #fff5f5; font-size: 12px; line-height: 1.5; }
.selection-detail { padding: 10px 12px; border-top: 1px solid #eef2f3; }
.selection-detail h3 { margin: 0 0 7px; color: #314a52; font-size: 12px; overflow-wrap: anywhere; }
.node-meta { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 8px; color: #7d8e93; font-size: 10px; }
.link-action { margin-bottom: 8px; }
.link-hint { color: #86979c; font-size: 10px; }
.relation-list { display: grid; gap: 5px; }
.relation-row { display: grid; grid-template-columns: 30px minmax(0, auto) minmax(0, 1fr); align-items: baseline; gap: 5px; color: #7d8e93; font-size: 10px; }
.relation-row strong { color: #2f7771; font-size: 10px; font-weight: 600; }
.relation-row small { overflow: hidden; color: #526a71; text-overflow: ellipsis; white-space: nowrap; }
.no-relations { margin: 0; color: #86979c; font-size: 11px; }
.selected-file { display: grid; gap: 3px; padding: 9px 12px; border-top: 1px solid #eef2f3; color: #7d8e93; font-size: 10px; }
.selected-file strong { overflow: hidden; color: #526a71; font-size: 11px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.selected-file small { color: #86979c; font-size: 10px; }
.file-links { display: flex; flex-wrap: wrap; gap: 4px; }
.file-link { max-width: 100%; overflow: hidden; padding: 2px 5px; border: 1px solid #cbe2df; border-radius: 3px; color: #2f7771; background: #f2fbf9; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.panel-footer { display: flex; flex-wrap: wrap; gap: 5px 10px; padding: 9px 12px; border-top: 1px solid #eef2f3; color: #7d8e93; font-size: 11px; }
</style>
