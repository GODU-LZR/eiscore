<template>
  <div class="ai-copilot-container" :class="containerClasses">
    <div
      v-if="!state.isOpen && isWorker"
      class="ai-trigger-btn"
      @click="openAssistant"
    >
      <div class="ai-icon-wrapper">
        <span class="sparkle-icon">✨</span>
      </div>
      <span class="ai-label">工作助手</span>
    </div>

    <div v-else-if="state.isOpen" class="ai-window" :class="{ 'is-worker': isWorker, 'is-fullscreen': isWorkerFullscreen }">
      <div class="ai-header">
        <div class="header-left" @click="toggleHistory">
          <el-icon class="history-icon" :class="{ 'active': showHistory }"><Operation /></el-icon>
          <span class="title">{{ assistantTitle }}</span>
        </div>
        <div class="header-right">
          <el-tooltip v-if="isWorker" :content="isWorkerFullscreen ? '退出全屏' : '全屏'" placement="bottom">
            <el-icon class="action-icon" @click="toggleFullscreen">
              <component :is="isWorkerFullscreen ? ScaleToOriginal : FullScreen" />
            </el-icon>
          </el-tooltip>
          <el-tooltip v-if="isEnterprise" content="导出PDF" placement="bottom">
            <el-icon class="action-icon" @click="exportReportAsPdf"><Download /></el-icon>
          </el-tooltip>
          <el-tooltip content="新建对话" placement="bottom">
            <el-icon class="action-icon" @click="aiBridge.createNewSession()"><Plus /></el-icon>
          </el-tooltip>
          <el-icon class="close-btn" @click="closeAssistant"><Close /></el-icon>
        </div>
      </div>

      <div class="ai-body">
        <div class="history-sidebar" :class="{ 'show': showHistory }">
          <div class="sidebar-header">对话历史</div>
          <div class="session-list">
            <div
              v-for="sess in state.sessions"
              :key="sess.id"
              class="session-item"
              :class="{ 'active': sess.id === state.currentSessionId }"
              @click="switchSession(sess.id)"
            >
              <span class="session-title">{{ sess.title }}</span>
              <el-icon class="delete-icon" @click.stop="aiBridge.deleteSession(sess.id)"><Delete /></el-icon>
            </div>
          </div>
        </div>

        <div class="chat-area" @click="showHistory = false">
          <div class="messages-container" ref="messagesRef">
            <template v-if="currentSession">
              <div
                v-for="(msg, index) in currentSession.messages"
                :key="index"
                class="message-row"
                :class="msg.role"
              >
                <div class="avatar-wrapper">
                  <div class="avatar">{{ msg.role === 'user' ? '👤' : '✨' }}</div>
                </div>

                <div class="content-wrapper">
                  <div v-if="msg.files && msg.files.length" class="msg-files">
                    <div v-for="(file, idx) in msg.files" :key="idx" class="file-card">
                      <el-image
                        v-if="file.type === 'image'"
                        :src="file.url"
                        :preview-src-list="[file.url]"
                        class="msg-img"
                        fit="contain"
                      />
                      <div v-else class="doc-file">
                        <el-icon><Document /></el-icon>
                        <span>{{ file.name }}</span>
                      </div>
                    </div>
                  </div>

                <div class="bubble">
                  <div
                    class="markdown-body"
                    v-html="renderMarkdown(msg.content)"
                  ></div>
                  <span
                    v-if="msg.role === 'assistant' && index === currentSession.messages.length - 1 && state.isStreaming"
                    class="typing-cursor"
                  ></span>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getFormTemplateInfo(msg).schema"
                  class="form-template-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到表单模板</span>
                    <span class="card-name">{{ getFormTemplateInfo(msg).schema.title || '未命名模板' }}</span>
                  </div>
                  <div class="card-meta">
                    <span>区块: {{ getTemplateSectionCount(getFormTemplateInfo(msg).schema) }}</span>
                    <span>表格: {{ getTemplateTableCount(getFormTemplateInfo(msg).schema) }}</span>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="templateSaveState[msg.time] === 'saving'"
                      @click="saveFormTemplate(getFormTemplateInfo(msg).schema, msg.time)"
                    >
                      {{ templateSaveState[msg.time] === 'saved' ? '已保存' : '保存到模板库' }}
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getFormulaInfo(msg).formula && !isStreamingMessage(index)"
                  class="formula-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到公式</span>
                    <span class="card-name">{{ getFormulaInfo(msg).formula }}</span>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="formulaApplyState[msg.time] === 'applying'"
                      @click="applyAiFormula(getFormulaInfo(msg).formula, msg.time)"
                    >
                      {{ formulaApplyState[msg.time] === 'applied' ? '已应用' : '应用公式' }}
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getImportInfo(msg).rows && getImportInfo(msg).rows.length > 0 && !isStreamingMessage(index)"
                  class="import-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到表格导入数据</span>
                    <span class="card-name">共 {{ getImportInfo(msg).rows.length }} 行</span>
                  </div>
                  <div class="preview-table">
                    <el-table
                      :data="getImportPreview(getImportInfo(msg)).rows"
                      size="small"
                      border
                      style="width: 100%"
                      max-height="220"
                    >
                      <el-table-column
                        v-for="col in getImportPreview(getImportInfo(msg)).columns"
                        :key="col.prop"
                        :prop="col.prop"
                        :label="col.label"
                        min-width="120"
                      />
                    </el-table>
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="importState[msg.time] === 'importing'"
                      @click="applyDataImport(getImportInfo(msg), msg.time)"
                    >
                      {{ importState[msg.time] === 'done' ? '已导入' : '导入到当前表格' }}
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="msg.role === 'assistant' && getCategoryInfo(msg).data && !isStreamingMessage(index)"
                  class="import-card"
                >
                  <div class="card-header">
                    <span class="card-title">检测到物料分类</span>
                    <span class="card-name">共 {{ getCategoryInfo(msg).data.length }} 项</span>
                  </div>
                  <div class="preview-tree">
                    <el-tree
                      :data="getCategoryInfo(msg).data"
                      :props="{ label: 'label', children: 'children' }"
                      node-key="id"
                      default-expand-all
                    />
                  </div>
                  <div class="card-actions">
                    <el-button
                      size="small"
                      type="primary"
                      :loading="categoryImportState[msg.time] === 'importing'"
                      @click="applyCategoryImport(getCategoryInfo(msg), msg.time)"
                    >
                      {{ categoryImportState[msg.time] === 'done' ? '已保存' : '保存到物料分类' }}
                    </el-button>
                  </div>
                </div>


                <div
                  v-else-if="msg.role === 'assistant' && getFormTemplateInfo(msg).error && !(state.isStreaming && index === currentSession.messages.length - 1)"
                  class="form-template-error"
                >
                  模板解析失败，请检查 JSON 格式。
                </div>

                <div class="msg-actions">
                  <el-button link size="small" type="danger" icon="Delete" @click="aiBridge.deleteMessage(index)"></el-button>
                  <el-button
                      v-if="msg.role === 'user'"
                      link
                      size="small"
                      type="primary"
                      icon="Refresh"
                      @click="retryMessage(index)"
                    >重试</el-button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="input-section">
            <div v-if="state.selectedFiles.length" class="file-preview-bar">
              <div v-for="(file, idx) in state.selectedFiles" :key="idx" class="preview-item">
                <img v-if="file.type === 'image'" :src="file.url" />
                <div v-else class="doc-preview"><el-icon><Document /></el-icon></div>
                <div class="remove-btn" @click="state.selectedFiles.splice(idx, 1)">×</div>
              </div>
            </div>

            <div class="input-box">
              <el-upload
                action="#"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="(file) => aiBridge.handleFileSelect(file.raw)"
                class="upload-trigger"
              >
                <el-icon class="tool-icon"><Paperclip /></el-icon>
              </el-upload>

              <textarea
                v-model="state.inputBuffer"
                :placeholder="inputPlaceholder"
                @keydown.enter="handleEnter"
                :disabled="state.isLoading"
              ></textarea>

              <div class="send-btn" :class="{ 'disabled': state.isLoading || (!state.inputBuffer && !state.selectedFiles.length) }" @click="handleSend">
                <el-icon v-if="state.isLoading" class="is-loading"><Loading /></el-icon>
                <el-icon v-else><Position /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lightbox.visible" class="chart-lightbox" @click.self="closeLightbox">
      <div class="lightbox-content">
        <div class="lightbox-header">
          <span>{{ lightbox.type === 'echarts' ? '统计图预览' : '流程图预览' }}</span>
          <el-icon class="lightbox-close" @click="closeLightbox"><Close /></el-icon>
        </div>
        <div class="lightbox-body">
          <div v-if="lightbox.type === 'echarts'" ref="lightboxChartRef" class="lightbox-chart"></div>
          <div v-else class="lightbox-mermaid" v-html="lightbox.payload"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUpdated } from 'vue'
import { useDark } from '@vueuse/core'
import { aiBridge } from '@/utils/ai-bridge'
import { Operation, Close, Plus, Delete, Paperclip, Position, Loading, Document, Refresh, Download, FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'

const FULLSCREEN_KEY = 'eis_ai_worker_fullscreen'

const props = defineProps({
  mode: { type: String, default: 'enterprise' },
  closeRoute: { type: String, default: '' },
  autoOpen: { type: Boolean, default: false }
})

const state = aiBridge.state
const showHistory = ref(false)
const messagesRef = ref(null)
const lightboxChartRef = ref(null)
const lightbox = ref({ visible: false, type: '', payload: null })
let lightboxChart = null
const router = useRouter()
const isFullscreen = ref(false)
const isDark = useDark({ storageKey: 'eis_theme_global' })

const currentSession = computed(() => aiBridge.getCurrentSession())
const isWorker = computed(() => props.mode === 'worker')
const isEnterprise = computed(() => props.mode === 'enterprise')
const isWorkerFullscreen = computed(() => isWorker.value && isFullscreen.value)
const assistantTitle = computed(() => (isWorker.value ? '企业工作助手' : '企业经营助手'))
const inputPlaceholder = computed(() => (
  isWorker.value
    ? '把数据或问题告诉我，我帮你整理成能录入系统的格式...'
    : '输入消息，或上传图片/文档分析...'
))
const containerClasses = computed(() => ({
  'is-open': state.isOpen,
  'is-worker': isWorker.value,
  'is-fullscreen': isWorkerFullscreen.value && state.isOpen,
  'is-dark': isDark.value
}))

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true
})

const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info.trim().toLowerCase()
  if (MATERIAL_CATEGORY_BLOCKS.includes(info) || IMPORT_BLOCKS.includes(info)) {
    return ''
  }
  if (info === 'mermaid') {
    return `<div class="mermaid-chart" data-raw="${encodeURIComponent(token.content)}"></div>`
  }
  if (info === 'echarts') {
    return `<div class="echarts-chart" data-option="${encodeURIComponent(token.content)}"></div>`
  }
  if (defaultFence) {
    return defaultFence(tokens, idx, options, env, self)
  }
  return self.renderToken(tokens, idx, options)
}

mermaid.initialize({ startOnLoad: false, theme: 'default' })

const renderMarkdown = (text) => {
  if (!text) return ''
  return md.render(text)
}

const sanitizeJson = (jsonStr) => {
  if (!jsonStr) return ''
  let cleaned = jsonStr
  cleaned = cleaned.replace(/^\s*[^=]*=\s*/, '')
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1')
  cleaned = cleaned.replace(/\/\/.*(?=[\n\r])/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/'([^']*)'/g, (_, p1) => `"${p1.replace(/"/g, '\\"')}"`)
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
  return cleaned.trim()
}

const FORM_TEMPLATE_BLOCKS = ['form-template', 'form_template', 'form-schema', 'form_schema']
const templateSaveState = ref({})
const FORMULA_BLOCKS = ['formula']
const IMPORT_BLOCKS = ['data-import', 'data_import', 'grid-import', 'grid_import']
const MATERIAL_CATEGORY_BLOCKS = [
  'materials-categories',
  'material-categories',
  'materials_categories',
  'material_categories'
]
const formulaApplyState = ref({})
const importState = ref({})
const categoryImportState = ref({})

const getAuthToken = () => {
  const tokenStr = localStorage.getItem('auth_token')
  if (!tokenStr) return ''
  try {
    const parsed = JSON.parse(tokenStr)
    if (parsed && parsed.token) return parsed.token
  } catch (e) {
    return tokenStr
  }
  return tokenStr
}

const parseJwtPayload = (token) => {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch (e) {
    return null
  }
}

const getTokenUsername = (token) => {
  const payload = parseJwtPayload(token)
  const username = payload?.username
  return username ? String(username) : ''
}

const isTokenExpired = (token) => {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return Date.now() / 1000 >= payload.exp
}

const extractFormTemplate = (text) => {
  if (!text) return { schema: null, error: null }
  for (const tag of FORM_TEMPLATE_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const schema = JSON.parse(raw)
        if (!schema || !schema.layout) {
          return { schema: null, error: 'invalid' }
        }
        return { schema, error: null }
      } catch (e) {
        return { schema: null, error: 'parse' }
      }
    }
  }
  return { schema: null, error: null }
}

const getFormTemplateInfo = (msg) => extractFormTemplate(msg?.content || '')

const extractFormula = (text) => {
  if (!text) return { formula: null, error: null }
  for (const tag of FORMULA_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      const formula = match[1].trim()
      if (!formula) return { formula: null, error: 'empty' }
      return { formula, error: null }
    }
  }
  return { formula: null, error: null }
}

const extractImportData = (text) => {
  if (!text) return { rows: null, error: null }
  for (const tag of IMPORT_BLOCKS) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const data = JSON.parse(raw)
        const rows = Array.isArray(data) ? data : (data.rows || data.data || data.items || null)
        if (!Array.isArray(rows)) return { rows: null, error: 'invalid' }
        return { rows, error: null }
      } catch (e) {
        return { rows: null, error: 'parse' }
      }
    }
  }
  return { rows: null, error: null }
}

const getFormulaInfo = (msg) => extractFormula(msg?.content || '')
const getImportInfo = (msg) => extractImportData(msg?.content || '')

const normalizeCategoryTree = (list, parentId = '') => {
  if (!Array.isArray(list)) return []
  return list.map((item, idx) => {
    const raw = item && typeof item === 'object' ? item : { label: String(item ?? '').trim() }
    const label = String(raw.label ?? raw.name ?? '').trim() || `分类${idx + 1}`
    let id = String(raw.id ?? raw.code ?? '').trim()
    if (!id) {
      const segment = String(idx + 1).padStart(2, '0')
      id = parentId ? `${parentId}.${segment}` : segment
    }
    const children = normalizeCategoryTree(raw.children || raw.items || [], id)
    return { id, label, children: children.length ? children : undefined }
  })
}

const extractCategoryData = (text, blocks) => {
  if (!text) return { data: null, error: null }
  for (const tag of blocks) {
    const regex = new RegExp(`\\\`\`\`${tag}([\\s\\S]*?)\\\`\`\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const json = JSON.parse(raw)
        const list = Array.isArray(json)
          ? json
          : (json.list || json.items || json.categories || json.data || null)
        if (!Array.isArray(list)) return { data: null, error: 'invalid' }
        return { data: normalizeCategoryTree(list), error: null }
      } catch (e) {
        return { data: null, error: 'parse' }
      }
    }
  }
  return { data: null, error: null }
}

const getCategoryInfo = (msg) => extractCategoryData(msg?.content || '', MATERIAL_CATEGORY_BLOCKS)

const getImportPreview = (info) => {
  const rows = Array.isArray(info?.rows) ? info.rows : []
  if (rows.length === 0) return { columns: [], rows: [] }
  const keySet = new Set()
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => keySet.add(key))
  })
  const contextColumns = Array.isArray(state.currentContext?.columns)
    ? state.currentContext.columns
    : []
  const orderedKeys = []
  contextColumns.forEach((col) => {
    if (keySet.has(col.prop)) orderedKeys.push(col.prop)
  })
  keySet.forEach((key) => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key)
  })
  const labelMap = new Map(contextColumns.map(col => [col.prop, col.label]))
  const columns = orderedKeys.map((key) => ({
    prop: key,
    label: labelMap.get(key) || key
  }))
  return { columns, rows: rows.slice(0, 8) }
}

const getTemplateSectionCount = (schema) => {
  if (!schema?.layout) return 0
  return schema.layout.filter(item => item.type === 'section').length
}

const getTemplateTableCount = (schema) => {
  if (!schema?.layout) return 0
  return schema.layout.filter(item => item.type === 'table').length
}

const loadTemplateLibrary = async () => {
  try {
    const token = getAuthToken()
    const headers = { 'Accept': 'application/json', 'Accept-Profile': 'public' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch('/api/system_configs?key=eq.form_templates', {
      headers
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? (data[0].value || []) : []
  } catch (e) {
    return []
  }
}

const saveTemplateLibrary = async (templates) => {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public',
    'Prefer': 'resolution=merge-duplicates'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch('/api/system_configs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key: 'form_templates', value: templates })
  })
}

const buildTemplateRecord = (schema) => {
  const now = new Date().toISOString()
  const templateId = schema.templateId || schema.docType || `tpl_${Date.now()}`
  const name = schema.title || schema.name || 'AI生成模板'
  return {
    id: templateId,
    name,
    schema,
    source: 'ai',
    created_at: now,
    updated_at: now
  }
}

const saveFormTemplate = async (schema, messageKey) => {
  if (!schema) return
  if (templateSaveState.value[messageKey] === 'saved') return
  templateSaveState.value[messageKey] = 'saving'
  try {
    const templates = await loadTemplateLibrary()
    const record = buildTemplateRecord(schema)
    const idx = templates.findIndex(item => item.id === record.id)
    if (idx >= 0) {
      templates[idx] = { ...templates[idx], ...record, updated_at: new Date().toISOString() }
    } else {
      templates.unshift(record)
    }
    const res = await saveTemplateLibrary(templates)
    if (!res.ok) throw new Error('保存失败')
    templateSaveState.value[messageKey] = 'saved'
    ElMessage.success('模板已保存到模板库')
    window.dispatchEvent(new CustomEvent('eis-form-templates-updated', {
      detail: { templates, record }
    }))
  } catch (e) {
    templateSaveState.value[messageKey] = 'error'
    ElMessage.error('模板保存失败')
  }
}

const isStreamingMessage = (index) => {
  if (!currentSession.value) return false
  return state.isStreaming && index === currentSession.value.messages.length - 1
}

const applyAiFormula = (formula, messageKey) => {
  if (!formula) return
  if (formulaApplyState.value[messageKey] === 'applied') return
  formulaApplyState.value[messageKey] = 'applying'
  try {
    const event = new CustomEvent('eis-ai-apply-formula', { detail: { formula } })
    window.dispatchEvent(event)
    formulaApplyState.value[messageKey] = 'applied'
    ElMessage.success('公式已应用')
  } catch (e) {
    formulaApplyState.value[messageKey] = 'error'
    ElMessage.error('公式应用失败')
  }
}

const buildImportPayload = (rows, context) => {
  const staticProps = new Set((context?.staticColumns || []).map(col => col.prop))
  const labelToProp = new Map((context?.columns || []).map(col => [col.label, col.prop]))
  const propertyFields = new Set(context?.propertyFields || [])
  const token = getAuthToken()
  const tokenUsername = getTokenUsername(token)
  const currentUser = tokenUsername || context?.currentUser || ''
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return null
    const payload = { properties: {} }
    const rowProps = row.properties && typeof row.properties === 'object' ? row.properties : null
    Object.entries(row).forEach(([key, value]) => {
      if (key === 'properties') return
      let prop = key
      if (!staticProps.has(prop) && labelToProp.has(prop)) {
        prop = labelToProp.get(prop)
      }
      if (staticProps.has(prop)) {
        if (propertyFields.has(prop)) {
          payload.properties[prop] = value
        } else {
          payload[prop] = value
        }
      } else {
        payload.properties[prop] = value
      }
    })
    if (rowProps) {
      payload.properties = { ...payload.properties, ...rowProps }
    }
    if (staticProps.has('created_by') && currentUser) {
      payload.created_by = currentUser
    }
    if (Object.keys(payload.properties).length === 0) delete payload.properties
    return payload
  }).filter(Boolean)
}

const applyDataImport = async (info, messageKey) => {
  if (importState.value[messageKey] === 'done') return
  const context = aiBridge.state.currentContext
  const target = context?.importTarget
  if (!target?.apiUrl) {
    ElMessage.error('未找到可导入的表格上下文')
    return
  }
  const token = getAuthToken()
  const tokenUsername = getTokenUsername(token)
  const currentUser = tokenUsername || context?.currentUser || ''
  const rows = info?.rows || []
  if (!rows.length) {
    ElMessage.warning('没有可导入的数据')
    return
  }
  const labelToProp = new Map((context?.columns || []).map(col => [col.label, col.prop]))
  const categories = Array.isArray(context?.materialsCategories) ? context.materialsCategories : []
  const categoryMap = new Map()
  const buildCategoryMap = (list, parentName = '') => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      const label = String(item?.label || '').trim()
      const id = String(item?.id || '').trim()
      if (!label || !id) return
      const fullName = parentName ? `${parentName}-${label}` : label
      categoryMap.set(label, id)
      categoryMap.set(fullName, id)
      if (Array.isArray(item.children)) {
        buildCategoryMap(item.children, fullName)
      }
    })
  }
  buildCategoryMap(categories)
  const getRowValue = (row, prop, labels = []) => {
    if (row[prop] !== undefined && row[prop] !== null && row[prop] !== '') return row[prop]
    for (const label of labels) {
      if (row[label] !== undefined && row[label] !== null && row[label] !== '') return row[label]
      const mapped = labelToProp.get(label)
      if (mapped && row[mapped] !== undefined && row[mapped] !== null && row[mapped] !== '') return row[mapped]
    }
    return ''
  }
  const parseSeq = (code) => {
    if (!code) return 0
    const parts = String(code).split('.')
    const tail = parts[parts.length - 1]
    const num = Number(tail)
    return Number.isFinite(num) ? num : 0
  }
  const nextSeqMap = new Map()
  const fetchNextCode = async (prefix) => {
    if (nextSeqMap.has(prefix)) {
      const next = nextSeqMap.get(prefix) + 1
      nextSeqMap.set(prefix, next)
      return `${prefix}.${String(next).padStart(4, '0')}`
    }
    const token = getAuthToken()
    const headers = { 'Accept': 'application/json', 'Accept-Profile': 'public' }
    if (token) headers.Authorization = `Bearer ${token}`
    const likePattern = `${prefix}.%`
    const url = `/api/raw_materials?select=batch_no&batch_no=like.${encodeURIComponent(
      likePattern
    )}&order=batch_no.desc&limit=1`
    const res = await fetch(url, { headers })
    const data = res.ok ? await res.json() : []
    const latest = Array.isArray(data) && data.length ? data[0].batch_no : ''
    const next = parseSeq(latest) + 1
    nextSeqMap.set(prefix, next)
    return `${prefix}.${String(next).padStart(4, '0')}`
  }

  let skipped = 0
  const cleanedRows = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const name = getRowValue(row, 'name', ['物料名称', '名称'])
    if (!name) {
      skipped += 1
      continue
    }
    const categoryRaw = getRowValue(row, 'category', ['物料分类', '物料分类编码'])
    const categoryCode = typeof categoryRaw === 'string'
      ? (categoryMap.get(categoryRaw.trim()) || categoryRaw.trim())
      : categoryRaw
    if (categoryCode) row.category = categoryCode
    const batchNo = getRowValue(row, 'batch_no', ['物料编码'])
    if (!batchNo) {
      if (!categoryCode) {
        skipped += 1
        continue
      }
      row.batch_no = await fetchNextCode(categoryCode)
    }
    if (currentUser) {
      row.created_by = currentUser
    }
    row.name = name
    cleanedRows.push(row)
  }

  const payload = buildImportPayload(cleanedRows, context)
  if (!payload.length) {
    ElMessage.warning('导入数据格式不正确')
    return
  }
  importState.value[messageKey] = 'importing'
  try {
    if (token && isTokenExpired(token)) {
      importState.value[messageKey] = 'error'
      ElMessage.error('登录已过期，请重新登录后再导入')
      return
    }
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    if (target.profile) {
      headers['Accept-Profile'] = target.profile
      headers['Content-Profile'] = target.profile
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const url = target.apiUrl.startsWith('/api') ? target.apiUrl : `/api${target.apiUrl}`
    if (currentUser) {
      payload.forEach((item) => { item.created_by = currentUser })
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    if (res.status === 401) {
      importState.value[messageKey] = 'error'
      ElMessage.error('登录已过期，请重新登录后再导入')
      return
    }
    if (!res.ok) throw new Error(`导入失败: ${res.status}`)
    importState.value[messageKey] = 'done'
    const extra = skipped > 0 ? `，跳过 ${skipped} 行（物料名称缺失）` : ''
    ElMessage.success(`已导入 ${payload.length} 行${extra}`)
    const event = new CustomEvent('eis-grid-imported', { detail: { viewId: target.viewId } })
    window.dispatchEvent(event)
  } catch (e) {
    importState.value[messageKey] = 'error'
    ElMessage.error('导入失败')
  }
}

const saveSystemConfig = async (key, value) => {
  const token = getAuthToken()
  if (token && isTokenExpired(token)) {
    throw new Error('登录已过期')
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public',
    'Prefer': 'resolution=merge-duplicates'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/system_configs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value })
  })
  if (res.status === 401) throw new Error('登录已过期')
  if (!res.ok) throw new Error('保存失败')
}

const getNextSegment = (siblings = []) => {
  let max = 0
  siblings.forEach((item) => {
    const id = String(item?.id || '')
    const segment = id.split('.').pop()
    const num = Number(segment)
    if (Number.isFinite(num) && num > max) max = num
  })
  return String(max + 1).padStart(2, '0')
}

const assignCategoryCodes = (items = [], siblings = [], parentId = '', level = 1, maxDepth = 2) => {
  if (!Array.isArray(items)) return []
  if (level > maxDepth) return []
  const localSiblings = Array.isArray(siblings) ? siblings : []
  const assigned = []
  items.forEach((item) => {
    const label = String(item?.label || item?.name || '').trim()
    if (!label) return
    const segment = getNextSegment(localSiblings.concat(assigned))
    const id = parentId ? `${parentId}.${segment}` : segment
    const children = assignCategoryCodes(item?.children || [], [], id, level + 1, maxDepth)
    assigned.push({ id, label, children: children.length ? children : undefined })
  })
  return assigned
}

const applyCategoryImport = async (info, messageKey) => {
  if (categoryImportState.value[messageKey] === 'done') return
  const list = info?.data || []
  if (!Array.isArray(list) || list.length === 0) {
    ElMessage.warning('没有可保存的物料分类')
    return
  }
  categoryImportState.value[messageKey] = 'importing'
  try {
    const existingRes = await fetch('/api/system_configs?key=eq.materials_categories', {
      headers: { 'Accept-Profile': 'public' }
    })
    const existingJson = existingRes.ok ? await existingRes.json() : []
    const existingRow = Array.isArray(existingJson) && existingJson.length ? existingJson[0] : null
    const existingList = Array.isArray(existingRow?.value) ? existingRow.value : []
    const maxDepth = Number(aiBridge.state.currentContext?.materialsCategoryDepth || 2) === 3 ? 3 : 2
    const appended = assignCategoryCodes(list, existingList, '', 1, maxDepth)
    const nextList = existingList.concat(appended)
    await saveSystemConfig('materials_categories', nextList)
    categoryImportState.value[messageKey] = 'done'
    ElMessage.success('物料分类已保存')
    window.dispatchEvent(new CustomEvent('eis-materials-categories-updated', { detail: { list: nextList } }))
  } catch (e) {
    categoryImportState.value[messageKey] = 'error'
    ElMessage.error(e?.message || '保存失败')
  }
}

const escapeHtml = (value) => {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const validateEchartsOption = (option) => {
  if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
    return '图表配置缺少必要的 series 数据'
  }
  return ''
}

const buildPrintableHtml = () => {
  const container = messagesRef.value?.cloneNode(true)
  if (!container) return ''

  container.querySelectorAll('.msg-actions').forEach(node => node.remove())
  container.querySelectorAll('.typing-cursor').forEach(node => node.remove())

  const echartsNodes = Array.from(container.querySelectorAll('.echarts-chart'))
  echartsNodes.forEach((node, index) => {
    const liveNode = document.querySelectorAll('.echarts-chart')[index]
    const instance = liveNode ? echarts.getInstanceByDom(liveNode) : null
    if (instance) {
      const dataUrl = instance.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' })
      const img = document.createElement('img')
      img.src = dataUrl
      img.style.maxWidth = '100%'
      img.style.display = 'block'
      node.replaceWith(img)
    }
  })

  return container.innerHTML
}

const exportReportAsPdf = () => {
  const html = buildPrintableHtml()
  if (!html) return

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>企业经营报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #303133; }
          .message-row { display: flex; gap: 12px; margin-bottom: 16px; }
          .message-row.user { flex-direction: row-reverse; }
          .bubble { background: #fff; padding: 12px 16px; border-radius: 12px; border: 1px solid #ebeef5; }
          .msg-files { margin-bottom: 8px; }
          pre { background: #f5f7fa; padding: 10px; border-radius: 6px; }
          .mermaid-chart svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h2>企业经营报告</h2>
        ${html}
      </body>
    </html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 500)
}

const openLightbox = async (type, payload) => {
  lightbox.value = { visible: true, type, payload }
  await nextTick()
  if (type === 'echarts' && lightboxChartRef.value) {
    if (lightboxChart) {
      lightboxChart.dispose()
    }
    lightboxChart = echarts.init(lightboxChartRef.value)
    lightboxChart.setOption(payload)
  }
}

const closeLightbox = () => {
  lightbox.value = { visible: false, type: '', payload: null }
  if (lightboxChart) {
    lightboxChart.dispose()
    lightboxChart = null
  }
}

const openAssistant = () => {
  aiBridge.setMode(props.mode)
  aiBridge.openWindow()
}

const closeAssistant = () => {
  if (props.closeRoute) {
    aiBridge.closeWindow()
    router.push(props.closeRoute)
    return
  }
  aiBridge.toggleWindow()
}

const toggleFullscreen = () => {
  if (!isWorker.value) return
  isFullscreen.value = !isFullscreen.value
  try {
    localStorage.setItem(FULLSCREEN_KEY, isFullscreen.value ? '1' : '0')
  } catch {}
}

const bindRetry = (node) => {
  const retryButton = node.querySelector('.chart-retry')
  if (retryButton && !retryButton.dataset.bound) {
    retryButton.dataset.bound = 'true'
    retryButton.addEventListener('click', () => {
      node.removeAttribute('data-processed')
      node.innerHTML = ''
      renderCharts()
    })
  }
}

const renderCharts = async () => {
  await nextTick()

  const mermaidNodes = document.querySelectorAll('.mermaid-chart:not([data-processed])')
  mermaidNodes.forEach(async (node, index) => {
    try {
      node.setAttribute('data-processed', 'true')
      const text = decodeURIComponent(node.getAttribute('data-raw') || '')
      await mermaid.parse(text)
      const id = `mermaid-${Date.now()}-${index}`
      const { svg } = await mermaid.render(id, text)
      node.innerHTML = svg
      if (!node.dataset.bound) {
        node.dataset.bound = 'true'
        node.addEventListener('dblclick', () => openLightbox('mermaid', svg))
      }
    } catch (e) {
      const safeCode = escapeHtml(decodeURIComponent(node.getAttribute('data-raw') || ''))
      node.innerHTML = `
        <div class="chart-error">
          <span>流程图渲染失败</span>
          <button class="chart-retry">重试</button>
        </div>
        <details class="chart-details">
          <summary>查看 Mermaid 代码</summary>
          <pre>${safeCode}</pre>
        </details>
      `
      bindRetry(node)
    }
  })

  const echartsNodes = document.querySelectorAll('.echarts-chart:not([data-processed])')
  echartsNodes.forEach((node) => {
    try {
      node.setAttribute('data-processed', 'true')
      const jsonStr = decodeURIComponent(node.getAttribute('data-option') || '')
      const sanitized = sanitizeJson(jsonStr)
      const option = JSON.parse(sanitized)
      const validationError = validateEchartsOption(option)
      if (validationError) {
        node.innerHTML = `<div class="chart-error">${validationError} <button class="chart-retry">重试</button></div>`
        bindRetry(node)
        return
      }
      node.style.width = '100%'
      node.style.height = '320px'
      const chart = echarts.init(node)
      chart.setOption(option)
      if (!node.dataset.bound) {
        node.dataset.bound = 'true'
        node.addEventListener('dblclick', () => openLightbox('echarts', option))
      }
    } catch (e) {
      console.error(e)
      const raw = decodeURIComponent(node.getAttribute('data-option') || '')
      const safeJson = escapeHtml(raw)
      node.innerHTML = `
        <div class="chart-error">
          <span>统计图渲染失败: 请确保 AI 输出标准 JSON</span>
          <button class="chart-retry">重试</button>
        </div>
        <details class="chart-details">
          <summary>查看原始 JSON</summary>
          <pre>${safeJson}</pre>
        </details>
      `
      bindRetry(node)
    }
  })
}

onUpdated(renderCharts)

const toggleHistory = () => {
  showHistory.value = !showHistory.value
}

const switchSession = (id) => {
  aiBridge.switchSession(id)
  showHistory.value = false
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const handleEnter = (event) => {
  if (!event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (state.isLoading) return
  const text = state.inputBuffer
  aiBridge.sendMessage(text)
}

const retryMessage = (index) => {
  aiBridge.retryMessageAt(index)
}

watch(() => currentSession.value?.messages.length, scrollToBottom)
watch(() => currentSession.value?.messages[currentSession.value?.messages.length - 1]?.content, scrollToBottom)
watch(() => state.isOpen, (val) => { if (val) scrollToBottom() })

onMounted(() => {
  try {
    isFullscreen.value = localStorage.getItem(FULLSCREEN_KEY) === '1'
  } catch {}
  aiBridge.loadConfig()
  aiBridge.setMode(props.mode)
  if (props.autoOpen) {
    aiBridge.openWindow()
  }
})

watch(() => props.mode, (val) => {
  aiBridge.setMode(val)
})
</script>

<style scoped lang="scss">
$primary-color: var(--el-color-primary, #409EFF);
$bg-color: #ffffff;
$chat-bg: #f5f7fa;
$border-color: #e4e7ed;

.ai-copilot-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 9999;
  --ai-panel-bg: var(--el-color-primary-light-9, #f5f7fa);
  --ai-panel-surface: #ffffff;
  --ai-panel-border: #e4e7ed;

  &.is-open {
    inset: 0;
  }

  &.is-open.is-worker {
    inset: auto;
    right: 30px;
    top: 80px;
    width: 380px;
    height: calc(100vh - 160px);
    left: auto;
  }

  &.is-open.is-worker.is-fullscreen {
    inset: 0;
    width: 100vw;
    height: 100vh;
    right: 0;
    left: 0;
    top: 0;
    bottom: 0;
  }
}

.ai-trigger-btn {
  width: 60px;
  height: 60px;
  background: $primary-color;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba($primary-color, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: all 0.3s;

  &:hover { transform: translateY(-2px); }
  .sparkle-icon { font-size: 24px; }
  .ai-label { font-size: 10px; font-weight: 600; }
}

.ai-window {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: var(--ai-panel-bg);
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);

  &.is-worker {
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }

  &.is-worker.is-fullscreen {
    border-radius: 0;
    box-shadow: none;
  }
}

.ai-header {
  height: 52px;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  background: var(--ai-panel-surface);

  .header-left {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
    .history-icon.active { transform: rotate(90deg); color: $primary-color; }
    .title { font-weight: 600; font-size: 15px; }
  }
  .header-right {
    display: flex; gap: 12px; font-size: 18px; color: #909399;
    .el-icon { cursor: pointer; &:hover { color: $primary-color; } }
  }
}

.ai-body { flex: 1; display: flex; position: relative; overflow: hidden; }

.history-sidebar {
  position: absolute; left: 0; top: 0; bottom: 0; width: 220px;
  background: #f9fafc; border-right: 1px solid $border-color;
  transform: translateX(-100%); transition: transform 0.3s ease; z-index: 10;
  display: flex; flex-direction: column;
  &.show { transform: translateX(0); }

  .sidebar-header { padding: 12px; font-weight: 600; color: #909399; font-size: 12px; }
  .session-list { flex: 1; overflow-y: auto; padding: 0 8px; }
  .session-item {
    padding: 10px; margin-bottom: 4px; border-radius: 8px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; color: #606266;
    &:hover { background: #eef0f5; }
    &.active { background: #ecf5ff; color: $primary-color; }
    .session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .delete-icon { display: none; &:hover { color: #f56c6c; } }
    &:hover .delete-icon { display: block; }
  }
}

.chat-area { flex: 1; display: flex; flex-direction: column; background: var(--ai-panel-bg); width: 100%; }

.messages-container {
  flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;
}

.message-row {
  display: flex; gap: 12px;
  &.user { flex-direction: row-reverse; }

  .avatar {
    width: 32px; height: 32px; border-radius: 8px; background: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  &.user .avatar { background: $primary-color; color: white; }

  .content-wrapper {
    max-width: 85%; display: flex; flex-direction: column;
  }

  .msg-files {
    display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
    .msg-img { max-width: 200px; height: auto; border-radius: 8px; border: 1px solid $border-color; background: #fff; }
    .doc-file {
      padding: 8px 12px; background: #fff; border: 1px solid $border-color; border-radius: 8px;
      display: flex; align-items: center; gap: 6px; font-size: 12px;
    }
  }

  .bubble {
    padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05); background: #fff; color: #303133;
    position: relative;
  }
  &.user .bubble { background: $primary-color; color: #fff; border-top-right-radius: 2px; }
  &.assistant .bubble { border-top-left-radius: 2px; }

  .msg-actions {
    margin-top: 4px; opacity: 0; transition: opacity 0.2s; display: flex; gap: 4px;
  }
  &:hover .msg-actions { opacity: 1; }
}

.input-section {
  background: var(--ai-panel-surface); border-top: 1px solid $border-color; padding: 12px;

  .file-preview-bar {
    display: flex; gap: 8px; margin-bottom: 8px; overflow-x: auto; padding-bottom: 4px;
    .preview-item {
      position: relative; width: 48px; height: 48px; flex-shrink: 0;
      border-radius: 6px; border: 1px solid $border-color; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
      .doc-preview { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
      .remove-btn {
        position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff;
        width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;
        font-size: 10px; cursor: pointer;
      }
    }
  }

  .input-box {
    display: flex; align-items: center;
    gap: 10px; background: #f5f7fa; border-radius: 20px; padding: 4px 8px 4px 12px;
    border: 1px solid transparent; transition: all 0.2s;

    &:focus-within { background: #fff; border-color: $primary-color; box-shadow: 0 0 0 2px rgba($primary-color, 0.1); }

    .upload-trigger { display: flex; }
    .tool-icon {
      font-size: 20px; color: #909399; cursor: pointer; padding: 4px;
      &:hover { color: $primary-color; }
    }

    textarea {
      flex: 1; background: transparent; border: none; resize: none;
      height: 36px; padding: 8px 0; font-size: 14px; font-family: inherit;
      &:focus { outline: none; }
    }

    .send-btn {
      width: 32px; height: 32px; background: $primary-color; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; color: white;
      cursor: pointer; transition: transform 0.2s; flex-shrink: 0;
      &.disabled { background: #c0c4cc; cursor: not-allowed; }
      &:not(.disabled):hover { transform: scale(1.1); }
      .is-loading { animation: rotate 1s linear infinite; }
    }
  }
}

.markdown-body {
  :deep(p) { margin: 0 0 8px 0; &:last-child { margin-bottom: 0; } }
  :deep(pre) {
    background: #282c34; color: #abb2bf; padding: 10px;
    border-radius: 6px; overflow-x: auto; margin: 8px 0;
  }
  :deep(code) { font-family: 'Consolas', monospace; }
  :deep(img) { max-width: 100%; border-radius: 4px; }

  :deep(.echarts-chart),
  :deep(.mermaid-chart) {
    width: 100%;
    min-height: 240px;
    overflow: hidden;
  }

  :deep(.mermaid-chart svg) {
    max-width: 100%;
    height: auto;
  }
}

.form-template-card {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formula-card,
.import-card {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-template-card .card-header,
.formula-card .card-header,
.import-card .card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}

.form-template-card .card-title,
.formula-card .card-title,
.import-card .card-title {
  font-size: 12px;
  color: #909399;
}

.form-template-card .card-name,
.formula-card .card-name,
.import-card .card-name {
  font-size: 13px;
}

.form-template-card .card-meta,
.formula-card .card-meta,
.import-card .card-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  gap: 12px;
}

.form-template-card .card-actions,
.formula-card .card-actions,
.import-card .card-actions {
  display: flex;
  justify-content: flex-end;
}

.preview-table,
.preview-tree {
  margin-top: 8px;
  background: #fff;
  border: none;
  border-radius: 8px;
  padding: 0;
  max-height: 240px;
  overflow: auto;
}

.preview-table :deep(.el-table) {
  border: none;
}
.preview-table :deep(.el-table__inner-wrapper::before),
.preview-table :deep(.el-table::before) {
  height: 0;
}

.form-template-error {
  margin-top: 6px;
  font-size: 12px;
  color: #f56c6c;
}

.chart-error {
  color: #f56c6c;
  font-size: 12px;
  padding: 8px 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chart-details {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  max-width: 100%;
  summary {
    cursor: pointer;
    color: #606266;
  }
  pre {
    background: #f5f7fa;
    padding: 8px;
    border-radius: 6px;
    overflow: auto;
    max-height: 240px;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.chart-retry {
  background: #fff;
  border: 1px solid $border-color;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  color: #606266;
  &:hover { color: $primary-color; border-color: $primary-color; }
}

.typing-cursor {
  display: inline-block; width: 6px; height: 14px; background: $primary-color;
  animation: blink 1s infinite; vertical-align: middle; margin-left: 4px;
}

.chart-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.lightbox-content {
  width: min(90vw, 980px);
  height: min(90vh, 720px);
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;
  font-weight: 600;
}

.lightbox-close {
  cursor: pointer;
  &:hover { color: $primary-color; }
}

.lightbox-body {
  flex: 1;
  padding: 12px;
}

.lightbox-chart {
  width: 100%;
  height: 100%;
}

.lightbox-mermaid {
  width: 100%;
  height: 100%;
  overflow: auto;
}

@keyframes blink { 50% { opacity: 0; } }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.ai-copilot-container.is-dark .ai-window {
  background: #0f172a;
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .ai-header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
.ai-copilot-container.is-dark .ai-header .header-right {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .history-sidebar {
  background: #0b1220;
  border-right-color: #1f2937;
}
.ai-copilot-container.is-dark .history-sidebar .sidebar-header {
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .session-item {
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .session-item:hover {
  background: rgba(148, 163, 184, 0.15);
}
.ai-copilot-container.is-dark .session-item.active {
  background: rgba(96, 165, 250, 0.2);
}
.ai-copilot-container.is-dark .chat-area {
  background: #0b1220;
}
.ai-copilot-container.is-dark .message-row .avatar {
  background: #111827;
  color: #f3f4f6;
  box-shadow: none;
}
.ai-copilot-container.is-dark .message-row .bubble {
  background: #111827;
  color: #f3f4f6;
  border: 1px solid #1f2937;
  box-shadow: none;
}
.ai-copilot-container.is-dark .message-row.user .bubble {
  color: #ffffff;
}
.ai-copilot-container.is-dark .msg-files .doc-file,
.ai-copilot-container.is-dark .msg-files .msg-img {
  background: #0f172a;
  border-color: #1f2937;
  color: #e5e7eb;
}
.ai-copilot-container.is-dark .input-section {
  background: #0f172a;
  border-top-color: #1f2937;
}
.ai-copilot-container.is-dark .input-box {
  background: #0b1220;
  border-color: #1f2937;
}
.ai-copilot-container.is-dark .input-box textarea {
  color: #f3f4f6;
}
.ai-copilot-container.is-dark .tool-icon {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .form-template-card,
.ai-copilot-container.is-dark .formula-card,
.ai-copilot-container.is-dark .import-card {
  background: #0f172a;
  border-color: #1f2937;
  color: #f3f4f6;
}
.ai-copilot-container.is-dark .form-template-card .card-title,
.ai-copilot-container.is-dark .formula-card .card-title,
.ai-copilot-container.is-dark .import-card .card-title,
.ai-copilot-container.is-dark .form-template-card .card-meta,
.ai-copilot-container.is-dark .formula-card .card-meta,
.ai-copilot-container.is-dark .import-card .card-meta {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .chart-details,
.ai-copilot-container.is-dark .chart-details summary {
  color: #cbd5f5;
}
.ai-copilot-container.is-dark .chart-details pre {
  background: #0b1220;
  border: 1px solid #1f2937;
}
.ai-copilot-container.is-dark .lightbox-content {
  background: #0f172a;
}
.ai-copilot-container.is-dark .lightbox-header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
</style>
