<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回列表</el-button>
      <div class="header-title">
        <h2>{{ pageTitle }}</h2>
        <el-tag size="small" :type="statusTagType">{{ statusText }}</el-tag>
      </div>
      <div class="header-actions">
        <el-select
          v-model="selectedTemplateId"
          size="small"
          placeholder="选择模板"
          style="width: 220px;"
        >
          <el-option
            v-for="tpl in templates"
            :key="tpl.id"
            :label="tpl.name"
            :value="tpl.id"
          />
        </el-select>
        <el-button @click="openTemplateManager">模板库</el-button>
        <el-button @click="reload" :loading="loading">刷新</el-button>
        <el-button type="primary" @click="saveDraft" :loading="saving" :disabled="!draft">保存</el-button>
        <el-button
          type="success"
          @click="activateDraft"
          :loading="activating"
          :disabled="!canActivate"
        >
          生效
        </el-button>
      </div>
    </div>

    <div class="form-container" v-loading="loading">
      <el-empty v-if="!draft" description="暂无数据" />

      <template v-else>
        <div v-if="!isEditable" class="active-edit-panel">
          <div class="panel-title">可修改信息</div>
          <el-form :model="form" label-width="120px" class="active-edit-form">
            <el-form-item label="仓库" required>
              <el-select
                v-model="form.warehouse_id"
                filterable
                placeholder="请选择仓库"
                style="width: 100%;"
                :disabled="!canEditWarehouse"
                @change="handleWarehouseChange"
              >
                <el-option
                  v-for="opt in warehouseFlatOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" :disabled="!canEditRemark" />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="isEditable && draftType === 'in'" class="batch-generate-bar">
          <el-button type="primary" plain @click="generateBatchNo" :disabled="!form.rule_id || !form.material_id">
            生成批次号
          </el-button>
          <span class="batch-generate-tip">需要先选择物料与批次号规则</span>
        </div>

        <div class="doc-engine-wrap">
          <EisDocumentEngine
            v-if="activeSchema"
            :model-value="formModel"
            @update:modelValue="handleFormUpdate"
            :schema="activeSchema"
            :columns="allColumns"
            :readonly="!isEditable"
          />
          <el-empty v-else description="正在加载配置..." />
        </div>
      </template>
    </div>

    <el-dialog v-model="templateManagerVisible" title="模板库" width="860px">
      <div class="template-toolbar">
        <span class="template-tip">可预览、改名或删除模板</span>
        <el-button type="primary" size="small" @click="openTemplateCreate">新增模板</el-button>
      </div>
      <el-table :data="templates" size="small" border style="width: 100%">
        <el-table-column prop="name" label="模板名称" min-width="200" />
        <el-table-column prop="id" label="编号" min-width="180" />
        <el-table-column label="更新时间" width="170">
          <template #default="scope">
            {{ formatTemplateTime(scope.row.updated_at || scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" align="center">
          <template #default="scope">
            <div class="template-actions">
              <el-button size="small" plain @click="openTemplatePreview(scope.row)">预览</el-button>
              <el-button size="small" type="primary" @click="setCurrentTemplate(scope.row)">使用</el-button>
              <el-button size="small" type="warning" plain @click="openTemplateRename(scope.row)">改名</el-button>
              <el-button size="small" type="danger" @click="removeTemplate(scope.row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="templateEditVisible" :title="templateEditTitle" width="420px">
      <el-form :model="templateEditForm" label-width="90px">
        <el-form-item label="模板名称">
          <el-input v-model="templateEditForm.name" placeholder="如：库存入库单" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="templateSaving" @click="submitTemplateEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="templatePreviewVisible" title="模板预览" width="980px">
      <div class="template-preview-body">
        <EisDocumentEngine
          v-if="templatePreview"
          :model-value="formModel || {}"
          :schema="templatePreview.schema"
          :columns="allColumns"
          :readonly="true"
        />
        <el-empty v-else description="暂无可预览的模板" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'

import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'

const props = defineProps({
  id: { type: [String, Number], required: true }
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)
const saving = ref(false)
const activating = ref(false)

const draft = ref(null)
const materials = ref([])
const warehouseOptions = ref([])
const warehouseFlat = ref([])
const warehouseIndex = ref(new Map())
const batchRules = ref([])
const batchOptions = ref([])

const templates = ref([])
const selectedTemplateId = ref('')
const extraValues = ref({})
const templateManagerVisible = ref(false)
const templateEditVisible = ref(false)
const templatePreviewVisible = ref(false)
const templateSaving = ref(false)
const templateEditMode = ref('create')
const templatePreview = ref(null)
const templateEditForm = ref({ id: '', name: '' })

const unitOptions = ['个', '件', '箱', '吨', '千克', '克', '斤', '米']

const operatorName = computed(() => userStore.userInfo?.username || 'Admin')

const form = reactive({
  id: null,
  draft_type: '',
  status: 'created',
  transaction_no: '',
  material_id: null,
  warehouse_id: null,
  rule_id: '',
  batch_no: '',
  batch_id: null,
  quantity: null,
  unit: '个',
  production_date: null,
  remark: '',
  operator: '',
  created_at: ''
})

const draftType = computed(() => {
  const fromQuery = route.query.draftType ? String(route.query.draftType) : ''
  const fromData = draft.value?.draft_type ? String(draft.value.draft_type) : ''
  return fromQuery || fromData || ''
})

const draftTypeText = computed(() => (draftType.value === 'in' ? '入库' : (draftType.value === 'out' ? '出库' : '')))

const pageTitle = computed(() => {
  if (draftType.value === 'in') return '入库表单'
  if (draftType.value === 'out') return '出库表单'
  return '单据表单'
})

const statusText = computed(() => {
  const s = String(form.status || '').toLowerCase()
  if (s === 'active') return '已生效'
  if (s === 'created' || s === 'draft') return '草稿'
  return form.status || '草稿'
})

const statusTagType = computed(() => {
  const s = String(form.status || '').toLowerCase()
  if (s === 'active') return 'success'
  return 'info'
})

const isEditable = computed(() => String(form.status || 'created') === 'created')
const canEditWarehouse = computed(() => isEditable.value || String(form.status || '') === 'active')
const canEditRemark = computed(() => isEditable.value || String(form.status || '') === 'active')

const templateEditTitle = computed(() => (templateEditMode.value === 'rename' ? '修改模板名称' : '新增模板'))

const formModel = computed(() => ({
  ...form,
  draft_type: draftType.value || form.draft_type,
  properties: extraValues.value || {}
}))

const materialSelectOptions = computed(() => (
  (materials.value || []).map(m => ({
    label: `${m.batch_no || ''} - ${m.name || ''}`.trim() || (m.name || ''),
    value: m.id
  }))
))

const warehouseFlatOptions = computed(() => {
  const list = Array.isArray(warehouseOptions.value) ? warehouseOptions.value : []
  const out = []
  const walk = (nodes, prefix = '') => {
    nodes.forEach(node => {
      const name = node?.name || ''
      const label = prefix ? `${prefix} / ${name}` : name
      if (node?.id) out.push({ label, value: node.id })
      if (Array.isArray(node?.children) && node.children.length) {
        walk(node.children, label)
      }
    })
  }
  walk(list)
  return out
})

const ruleSelectOptions = computed(() => {
  const rules = (batchRules.value || []).map(r => ({ label: r.rule_name, value: r.id }))
  return rules
})

const unitSelectOptions = computed(() => unitOptions.map(u => ({ label: u, value: u })))

const batchSelectOptions = computed(() => {
  if (draftType.value !== 'out') return []
  return filteredBatches.value.map(b => ({ label: buildBatchLabel(b), value: b.id }))
})

const buildFallbackSchema = () => {
  const base = {
    docType: draftType.value === 'out' ? 'inventory_out_auto' : 'inventory_in_auto',
    title: pageTitle.value || '单据表单',
    docNo: 'transaction_no',
    layout: []
  }

  base.layout.push({
    type: 'section',
    title: '基础信息',
    cols: 2,
    children: [
      { label: '单据类型', field: 'draft_type' },
      { label: '状态', field: 'status' },
      { label: '单据号', field: 'transaction_no' },
      { label: '操作人', field: 'operator' },
      { label: '创建时间', field: 'created_at' }
    ]
  })

  const businessChildren = [
    { label: '物料', field: 'material_id' },
    { label: '仓库', field: 'warehouse_id' }
  ]
  if (draftType.value === 'in') {
    businessChildren.push(
      { label: '批次号规则', field: 'rule_id' },
      { label: '批次号', field: 'batch_no' },
      { label: '数量', field: 'quantity', widget: 'number' },
      { label: '单位', field: 'unit' },
      { label: '生产日期', field: 'production_date', widget: 'date' },
      { label: '备注', field: 'remark', widget: 'textarea' }
    )
  } else {
    businessChildren.push(
      { label: '批次号', field: 'batch_id' },
      { label: '批次号文本', field: 'batch_no' },
      { label: '数量', field: 'quantity', widget: 'number' },
      { label: '单位', field: 'unit' },
      { label: '备注', field: 'remark', widget: 'textarea' }
    )
  }
  base.layout.push({
    type: 'section',
    title: '业务信息',
    cols: 2,
    children: businessChildren
  })
  return base
}

const activeSchema = computed(() => {
  const current = templates.value.find(item => item.id === selectedTemplateId.value)
  return current?.schema || buildFallbackSchema()
})

const allColumns = computed(() => {
  return [
    { label: '单据类型', prop: 'draft_type', type: 'display' },
    { label: '状态', prop: 'status', type: 'display' },
    { label: '单据号', prop: 'transaction_no', type: 'display' },
    { label: '物料', prop: 'material_id', type: 'select', options: materialSelectOptions.value },
    { label: '仓库', prop: 'warehouse_id', type: 'select', options: warehouseFlatOptions.value },
    { label: '批次号规则', prop: 'rule_id', type: 'select', options: ruleSelectOptions.value },
    { label: '批次号', prop: 'batch_no', type: 'text' },
    { label: '批次号', prop: 'batch_id', type: 'select', options: batchSelectOptions.value },
    { label: '数量', prop: 'quantity', type: 'text' },
    { label: '单位', prop: 'unit', type: 'select', options: unitSelectOptions.value },
    { label: '生产日期', prop: 'production_date', type: 'text' },
    { label: '备注', prop: 'remark', type: 'text' },
    { label: '操作人', prop: 'operator', type: 'display' },
    { label: '创建时间', prop: 'created_at', type: 'display' }
  ]
})

const canActivate = computed(() => {
  if (!draft.value) return false
  if (!isEditable.value) return false
  if (!form.material_id || !form.warehouse_id || !form.quantity || !form.unit) return false
  if (draftType.value === 'in') return !!form.batch_no
  if (draftType.value === 'out') return !!form.batch_no && !!form.batch_id
  return false
})

const buildTree = (flat) => {
  const list = Array.isArray(flat) ? flat : []
  const byId = {}
  list.forEach(item => { if (item?.id) byId[item.id] = { ...item, children: [] } })
  const roots = []
  list.forEach(item => {
    if (!item?.id) return
    const node = byId[item.id]
    if (item.parent_id && byId[item.parent_id]) {
      byId[item.parent_id].children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

const buildWarehouseIndex = (list) => {
  const map = new Map()
  ;(Array.isArray(list) ? list : []).forEach(item => {
    if (item?.id) map.set(item.id, item)
  })
  warehouseIndex.value = map
}

const resolveWarehouseFullPath = (warehouseId) => {
  if (!warehouseId) return ''
  const map = warehouseIndex.value
  if (!map || typeof map.get !== 'function') return ''
  const names = []
  const seen = new Set()
  let current = map.get(warehouseId)
  while (current && current.id && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.name) names.push(current.name)
    current = current.parent_id ? map.get(current.parent_id) : null
  }
  return names.reverse().join(' / ')
}

const getErrorMessage = (e, fallback) => {
  if (!e) return fallback
  if (typeof e === 'string') return e
  const msg = e?.message || e?.error || ''
  const detail = e?.response?.data?.message || e?.response?.data?.details || e?.response?.data?.hint || ''
  return String(detail || msg || fallback)
}

const fillFormFromDraft = (d) => {
  form.id = d?.id ?? null
  form.draft_type = d?.draft_type ?? ''
  form.status = d?.status ?? 'created'
  form.transaction_no = d?.transaction_no ?? ''
  form.material_id = d?.material_id ?? null
  form.warehouse_id = d?.warehouse_id ?? null
  form.rule_id = d?.rule_id ?? ''
  form.batch_no = d?.batch_no ?? ''
  form.batch_id = d?.batch_id ?? null
  form.quantity = d?.quantity ?? null
  form.unit = d?.unit ?? '个'
  form.production_date = d?.production_date ?? null
  form.remark = d?.remark ?? ''
  form.operator = d?.operator ?? ''
  form.created_at = d?.created_at ?? ''
}

const handleFormUpdate = (nextValue) => {
  if (!nextValue) return
  const baseKeys = [
    'id',
    'draft_type',
    'status',
    'transaction_no',
    'material_id',
    'warehouse_id',
    'rule_id',
    'batch_no',
    'batch_id',
    'quantity',
    'unit',
    'production_date',
    'remark',
    'operator',
    'created_at'
  ]
  baseKeys.forEach((key) => {
    if (key in nextValue) form[key] = nextValue[key]
  })
  extraValues.value = nextValue.properties || {}
}

const loadMaterials = async () => {
  try {
    const res = await request({
      url: '/raw_materials?select=id,batch_no,name&order=batch_no.asc',
      headers: { 'Accept-Profile': 'public' }
    })
    materials.value = Array.isArray(res) ? res : []
  } catch (e) {
    console.error('加载物料失败:', e)
  }
}

const loadWarehouses = async () => {
  try {
    const res = await request({
      url: '/warehouses?order=code.asc',
      headers: { 'Accept-Profile': 'scm' }
    })
    const list = Array.isArray(res) ? res : []
    warehouseFlat.value = list
    buildWarehouseIndex(list)
    warehouseOptions.value = buildTree(list)
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const loadBatchRules = async () => {
  try {
    const res = await request({
      url: '/batch_no_rules?order=rule_name.asc',
      headers: { 'Accept-Profile': 'scm' }
    })
    batchRules.value = Array.isArray(res) ? res : []
  } catch (e) {
    console.error('加载批次号规则失败:', e)
  }
}

const loadBatches = async () => {
  try {
    const res = await request({
      url: '/inventory_batches?available_qty=gt.0&order=updated_at.desc',
      headers: { 'Accept-Profile': 'scm' }
    })
    const list = Array.isArray(res) ? res : []
    const materialMap = new Map((materials.value || []).map(item => [item.id, item.name]))
    batchOptions.value = list.map(item => ({
      ...item,
      material_name: item.material_name || materialMap.get(item.material_id) || '',
      warehouse_path: item.warehouse_path || resolveWarehouseFullPath(item.warehouse_id)
    }))
  } catch (e) {
    console.error('加载批次失败:', e)
  }
}

const buildBatchLabel = (b) => {
  if (!b) return ''
  const wh = b.warehouse_path || ''
  const bn = b.batch_no || ''
  const m = b.material_name || b.material_code || ''
  const qty = Number(b.available_qty || 0)
  const unit = b.unit || ''
  return `${bn} | ${m} | ${wh} | 可用 ${qty} ${unit}`
}

const filteredBatches = computed(() => {
  if (draftType.value !== 'out') return []
  const mid = form.material_id
  const wid = form.warehouse_id
  return (batchOptions.value || [])
    .filter(b => !mid || b.material_id === mid)
    .filter(b => !wid || b.warehouse_id === wid)
    .filter(b => Number(b.available_qty || 0) > 0)
})

const handleBatchPick = (batchId) => {
  const batch = batchOptions.value.find(b => b.id === batchId)
  if (!batch) return
  form.batch_no = batch.batch_no
  form.material_id = batch.material_id
  form.warehouse_id = batch.warehouse_id
  form.unit = batch.unit || form.unit
}

const handleMaterialChange = () => {
  if (draftType.value !== 'out') return
  if (form.batch_id && !filteredBatches.value.some(b => b.id === form.batch_id)) {
    form.batch_id = null
    form.batch_no = ''
  }
}

const handleWarehouseChange = () => {
  if (draftType.value !== 'out') return
  if (form.batch_id && !filteredBatches.value.some(b => b.id === form.batch_id)) {
    form.batch_id = null
    form.batch_no = ''
  }
}

const generateBatchNo = async () => {
  if (!form.rule_id || !form.material_id) {
    ElMessage.warning('请选择规则和物料')
    return
  }
  try {
    const batchNo = await request({
      url: '/rpc/generate_batch_no',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: {
        p_rule_id: form.rule_id,
        p_material_id: form.material_id,
        p_manual_override: null
      }
    })
    form.batch_no = batchNo
  } catch (e) {
    ElMessage.error(getErrorMessage(e, '批次号生成失败'))
  }
}

const loadTemplates = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.form_templates',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const list = res && res.length > 0 ? (res[0].value || []) : []
    templates.value = Array.isArray(list)
      ? list.filter(item => item && item.schema && Array.isArray(item.schema.layout))
      : []
    if (!selectedTemplateId.value && templates.value.length > 0) {
      selectedTemplateId.value = templates.value[0].id
    }
  } catch (e) {
    templates.value = []
  }
}

const saveTemplateLibrary = async (list) => {
  return request({
    url: '/system_configs',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Prefer': 'resolution=merge-duplicates'
    },
    data: { key: 'form_templates', value: list }
  })
}

const handleTemplatesUpdated = (event) => {
  const list = event?.detail?.templates
  if (Array.isArray(list)) {
    const filtered = list.filter(item => item && item.schema && Array.isArray(item.schema.layout))
    templates.value = filtered
    if (!selectedTemplateId.value && filtered.length > 0) {
      selectedTemplateId.value = filtered[0].id
    }
  } else {
    loadTemplates()
  }
}

const loadFormValues = async () => {
  if (!draft.value?.id || !selectedTemplateId.value) {
    extraValues.value = {}
    return
  }
  try {
    const res = await request({
      url: `/form_values?row_id=eq.${draft.value.id}&template_id=eq.${selectedTemplateId.value}`,
      method: 'get',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    if (res && res.length > 0) {
      extraValues.value = res[0].payload || {}
    } else {
      extraValues.value = {}
    }
  } catch (e) {
    extraValues.value = {}
  }
}

const saveFormValues = async () => {
  if (!draft.value?.id || !selectedTemplateId.value) return
  try {
    await request({
      url: '/form_values?on_conflict=template_id,row_id',
      method: 'post',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates'
      },
      data: {
        row_id: draft.value.id,
        template_id: selectedTemplateId.value,
        payload: extraValues.value || {}
      }
    })
  } catch (e) {
    ElMessage.warning('扩展字段保存失败')
  }
}

const formatTemplateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const openTemplateManager = () => {
  templateManagerVisible.value = true
}

const openTemplatePreview = (template) => {
  templatePreview.value = template || null
  templatePreviewVisible.value = true
}

const openTemplateCreate = () => {
  templateEditMode.value = 'create'
  templateEditForm.value = {
    id: '',
    name: activeSchema.value?.title || '新表单模板'
  }
  templateEditVisible.value = true
}

const openTemplateRename = (template) => {
  templateEditMode.value = 'rename'
  templateEditForm.value = {
    id: template?.id || '',
    name: template?.name || template?.schema?.title || ''
  }
  templateEditVisible.value = true
}

const setCurrentTemplate = (template) => {
  if (!template?.id) return
  selectedTemplateId.value = template.id
  ElMessage.success('已切换模板')
}

const submitTemplateEdit = async () => {
  const name = templateEditForm.value.name ? templateEditForm.value.name.trim() : ''
  if (!name) {
    ElMessage.warning('请输入模板名称')
    return
  }
  templateSaving.value = true
  try {
    const list = Array.isArray(templates.value) ? [...templates.value] : []
    const now = new Date().toISOString()
    if (templateEditMode.value === 'rename') {
      const idx = list.findIndex(item => item.id === templateEditForm.value.id)
      if (idx >= 0) {
        const nextSchema = list[idx].schema ? { ...list[idx].schema } : {}
        nextSchema.title = name
        list[idx] = { ...list[idx], name, schema: nextSchema, updated_at: now }
      }
    } else {
      const schema = JSON.parse(JSON.stringify(buildFallbackSchema()))
      schema.title = name
      const templateId = `tpl_${Date.now()}`
      schema.docType = templateId
      const record = {
        id: templateId,
        name,
        schema,
        source: 'manual',
        created_at: now,
        updated_at: now
      }
      list.unshift(record)
      selectedTemplateId.value = record.id
    }
    await saveTemplateLibrary(list)
    templates.value = list
    templateEditVisible.value = false
    ElMessage.success('模板已保存')
  } catch (e) {
    ElMessage.error('模板保存失败')
  } finally {
    templateSaving.value = false
  }
}

const removeTemplate = async (template) => {
  if (!template?.id) return
  try {
    await ElMessageBox.confirm('确定删除这个模板吗？删除后无法恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    const list = (templates.value || []).filter(item => item.id !== template.id)
    await saveTemplateLibrary(list)
    templates.value = list
    if (selectedTemplateId.value === template.id) {
      selectedTemplateId.value = list[0]?.id || ''
    }
    ElMessage.success('模板已删除')
  } catch (e) {
    ElMessage.error('模板删除失败')
  }
}

const loadDraft = async () => {
  loading.value = true
  try {
    const res = await request({
      url: `/inventory_drafts?id=eq.${props.id}`,
      method: 'get',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' }
    })
    const row = Array.isArray(res) ? res[0] : null
    draft.value = row
    if (row) fillFormFromDraft(row)
  } catch (e) {
    draft.value = null
    ElMessage.error(getErrorMessage(e, '加载单据失败'))
  } finally {
    loading.value = false
  }
}

const saveDraft = async () => {
  if (!draft.value?.id) return
  if (!form.material_id || !form.warehouse_id || !form.quantity || !form.unit) {
    ElMessage.warning('请填写必填项')
    return
  }
  if (draftType.value === 'in' && !form.batch_no) {
    ElMessage.warning('请输入批次号')
    return
  }
  if (draftType.value === 'out' && (!form.batch_id || !form.batch_no)) {
    ElMessage.warning('请选择批次号')
    return
  }

  saving.value = true
  try {
    const data = {
      material_id: form.material_id,
      warehouse_id: form.warehouse_id,
      quantity: form.quantity,
      unit: form.unit,
      remark: form.remark
    }
    if (draftType.value === 'in') {
      data.rule_id = form.rule_id ? form.rule_id : null
      data.batch_no = form.batch_no
      data.production_date = form.production_date || null
    } else if (draftType.value === 'out') {
      data.batch_id = form.batch_id
      data.batch_no = form.batch_no
    }

    await request({
      url: `/inventory_drafts?id=eq.${draft.value.id}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data
    })
    await saveFormValues()
    ElMessage.success('已保存')
    await loadDraft()
  } catch (e) {
    ElMessage.error(getErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

const activateDraft = async () => {
  if (!draft.value?.id) return
  if (!canActivate.value) {
    ElMessage.warning('草稿信息不完整，无法生效')
    return
  }

  activating.value = true
  try {
    if (draftType.value === 'in') {
      const res = await request({
        url: '/rpc/stock_in',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          p_material_id: form.material_id,
          p_warehouse_id: form.warehouse_id,
          p_quantity: form.quantity,
          p_unit: form.unit,
          p_batch_no: form.batch_no,
          p_production_date: form.production_date,
          p_remark: form.remark,
          p_operator: operatorName.value
        }
      })

      await request({
        url: `/inventory_drafts?id=eq.${draft.value.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          status: 'active',
          transaction_no: res?.transaction_no || null,
          batch_id: res?.batch_id || null
        }
      })
      ElMessage.success('入库已生效')
    } else if (draftType.value === 'out') {
      const res = await request({
        url: '/rpc/stock_out',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          p_material_id: form.material_id,
          p_warehouse_id: form.warehouse_id,
          p_quantity: form.quantity,
          p_unit: form.unit,
          p_batch_no: form.batch_no,
          p_remark: form.remark,
          p_operator: operatorName.value
        }
      })

      await request({
        url: `/inventory_drafts?id=eq.${draft.value.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: {
          status: 'active',
          transaction_no: res?.transaction_no || null,
          batch_id: res?.batch_id || form.batch_id || null
        }
      })
      ElMessage.success('出库已生效')
    }

    await saveFormValues()

    await loadDraft()
  } catch (e) {
    try {
      await request({
        url: `/inventory_drafts?id=eq.${draft.value.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: { status: 'created' }
      })
    } catch (_) {
      // ignore
    }
    ElMessage.error(getErrorMessage(e, '生效失败'))
  } finally {
    activating.value = false
  }
}

const reload = async () => {
  await loadDraft()
}

const goBack = () => {
  const to = draftType.value === 'out' ? { name: 'InventoryStockOut' } : { name: 'InventoryStockIn' }
  router.push(to)
}

onMounted(async () => {
  loadTemplates()
  window.addEventListener('eis-form-templates-updated', handleTemplatesUpdated)
  await Promise.all([loadMaterials(), loadWarehouses(), loadBatchRules()])
  if (draftType.value === 'out') {
    await loadBatches()
  }
  await loadDraft()
})

onUnmounted(() => {
  window.removeEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

watch(() => draftType.value, (t) => {
  if (t === 'out') {
    loadBatches()
  } else {
    batchOptions.value = []
  }
  if (t !== 'out') return
  if (form.batch_id && !filteredBatches.value.some(b => b.id === form.batch_id)) {
    form.batch_id = null
    form.batch_no = ''
  }
})

watch(() => form.batch_id, (val, oldVal) => {
  if (draftType.value !== 'out') return
  if (!val || val === oldVal) return
  handleBatchPick(val)
})

watch(() => form.material_id, () => {
  handleMaterialChange()
})

watch(() => form.warehouse_id, () => {
  handleWarehouseChange()
})

watch([selectedTemplateId, () => draft.value?.id], () => {
  loadFormValues()
})
</script>

<style scoped>
.detail-page {
  padding: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.form-container {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px 16px;
}

.active-edit-panel {
  margin-bottom: 14px;
  padding: 12px 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
}

.panel-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.active-edit-form {
  max-width: 720px;
}

.doc-engine-wrap {
  max-width: 980px;
}

.template-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.template-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.template-preview-body {
  max-height: 70vh;
  overflow: auto;
}

.batch-generate-bar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.batch-generate-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
