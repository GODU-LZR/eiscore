<template>
  <el-dialog
    :model-value="visible"
    width="860px"
    title="文件"
    top="8vh"
    destroy-on-close
    @close="closeDialog"
  >
    <div class="file-dialog-body">
      <div class="file-panel">
        <div class="file-toolbar">
          <el-button type="primary" @click="triggerSelect">上传文件</el-button>
          <el-button @click="clearFiles" :disabled="files.length === 0">清空</el-button>
          <span class="file-limit">最多 {{ maxCount }} 个，单个不超过 {{ maxSizeMb }}MB</span>
        </div>
        <div class="file-list">
          <div v-if="files.length === 0" class="file-empty">暂无文件</div>
          <div
            v-for="item in files"
            :key="item.id"
            class="file-item"
            :class="{ active: item.id === activeId }"
          >
            <div class="file-main" @click="setActive(item.id)">
              <div class="file-name">{{ item.name || '未命名文件' }}</div>
              <div class="file-meta">
                <span v-if="item.size">{{ formatSize(item.size) }}</span>
                <span v-if="item.ext">.{{ item.ext }}</span>
              </div>
            </div>
            <div class="file-actions">
              <el-button link type="primary" @click="downloadFile(item)">下载</el-button>
              <el-button link type="danger" @click="removeFile(item.id)">删除</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="file-preview">
        <div v-if="activeFile" class="file-preview-body">
          <img v-if="isImage(activeFile)" :src="previewUrl(activeFile)" alt="预览" class="file-preview-img" />
          <iframe v-else-if="isPdf(activeFile)" :src="previewUrl(activeFile)" class="file-preview-pdf"></iframe>
          <div v-else class="file-preview-empty">
            <div class="file-preview-text">暂不支持预览</div>
            <el-button type="primary" @click="downloadFile(activeFile)">下载查看</el-button>
          </div>
        </div>
        <div v-else class="file-preview-empty">请选择文件查看</div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      class="file-input"
      type="file"
      multiple
      :accept="acceptAttr"
      @change="handleFileInput"
    />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: { type: Boolean, default: false },
  params: { type: Object, default: null }
})

const emit = defineEmits(['update:visible'])

const files = ref([])
const activeId = ref('')
const fileInputRef = ref(null)

const colDef = computed(() => props.params?.colDef || {})
const maxCount = computed(() => Math.max(1, Number(colDef.value.fileMaxCount) || 3))
const maxSizeMb = computed(() => Math.max(1, Number(colDef.value.fileMaxSizeMb) || 20))

const defaultAccept = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.ppt', '.pptx']

const parseAccept = (raw) => {
  if (!raw) return defaultAccept
  const parts = String(raw)
    .split(/[,，;\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
  if (parts.length === 0) return defaultAccept
  return parts.map(item => {
    if (item.includes('/')) return item.toLowerCase()
    if (item.startsWith('.')) return item.toLowerCase()
    if (item === '*') return '*/*'
    return `.${item.toLowerCase()}`
  })
}

const acceptRules = computed(() => parseAccept(colDef.value.fileAccept))
const acceptAttr = computed(() => acceptRules.value.join(','))

const toList = (value) => {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  return [value]
}

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `file_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

const getExt = (name) => {
  if (!name) return ''
  const parts = String(name).split('.')
  if (parts.length <= 1) return ''
  return parts.pop().toLowerCase()
}

const normalizeItem = (item) => {
  if (item === null || item === undefined) return null
  if (typeof item === 'string') {
    const ext = getExt(item)
    return { id: createId(), name: item, ext }
  }
  if (typeof item === 'object') {
    const name = item.name || item.fileName || item.filename || item.title || item.url || item.file_url || ''
    const dataUrl = item.dataUrl || item.data_url || item.base64 || ''
    const url = item.url || item.file_url || ''
    const size = item.size || item.fileSize || 0
    const type = item.type || item.mime || ''
    const ext = item.ext || getExt(name)
    return {
      id: item.id || item.uuid || createId(),
      name,
      dataUrl,
      url,
      size,
      type,
      ext,
      uploadedAt: item.uploadedAt || item.uploaded_at || item.created_at || ''
    }
  }
  return null
}

const setFilesFromValue = (value) => {
  const list = toList(value)
    .map(normalizeItem)
    .filter(Boolean)
  files.value = list
  activeId.value = list[0]?.id || ''
}

const activeFile = computed(() => files.value.find(item => item.id === activeId.value) || null)

const setActive = (id) => {
  activeId.value = id
}

const isImage = (item) => {
  const ext = item.ext || getExt(item.name)
  if (item.type && item.type.startsWith('image/')) return true
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(String(ext).toLowerCase())
}

const isPdf = (item) => {
  const ext = item.ext || getExt(item.name)
  if (item.type && item.type.includes('pdf')) return true
  return String(ext).toLowerCase() === 'pdf'
}

const previewUrl = (item) => item.dataUrl || item.url || ''

const formatSize = (size) => {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

const isAllowedFile = (file) => {
  const rules = acceptRules.value
  if (!rules || rules.length === 0) return true
  const ext = `.${getExt(file.name)}`
  if (rules.includes('*/*')) return true
  if (ext && rules.includes(ext.toLowerCase())) return true
  if (file.type) {
    const type = file.type.toLowerCase()
    if (rules.includes(type)) return true
    const base = type.split('/')[0]
    if (rules.includes(`${base}/*`)) return true
  }
  return false
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const updateCellValue = (list) => {
  const field = props.params?.colDef?.field
  if (!field || !props.params?.node) return
  const payload = list.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type,
    size: item.size,
    dataUrl: item.dataUrl,
    url: item.url,
    ext: item.ext,
    uploadedAt: item.uploadedAt
  }))
  props.params.node.setDataValue(field, payload.length ? payload : null)
}

const handleFileInput = async (event) => {
  const input = event.target
  const picked = Array.from(input.files || [])
  input.value = ''
  if (picked.length === 0) return

  const remaining = maxCount.value - files.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多只能上传 ${maxCount.value} 个文件`)
    return
  }

  let skippedType = 0
  let skippedSize = 0
  const accepted = []
  picked.forEach(file => {
    if (accepted.length >= remaining) return
    if (!isAllowedFile(file)) {
      skippedType += 1
      return
    }
    if (file.size > maxSizeMb.value * 1024 * 1024) {
      skippedSize += 1
      return
    }
    accepted.push(file)
  })

  if (skippedType > 0) ElMessage.warning('有文件格式不支持，已忽略')
  if (skippedSize > 0) ElMessage.warning(`有文件超过 ${maxSizeMb.value}MB，已忽略`)
  if (accepted.length === 0) return

  const newItems = []
  for (const file of accepted) {
    try {
      const dataUrl = await readFileAsDataUrl(file)
      newItems.push({
        id: createId(),
        name: file.name,
        type: file.type || '',
        size: file.size || 0,
        dataUrl,
        ext: getExt(file.name),
        uploadedAt: new Date().toISOString()
      })
    } catch (e) {
      ElMessage.warning(`文件读取失败：${file.name}`)
    }
  }

  const next = [...files.value, ...newItems]
  files.value = next
  if (!activeId.value && next.length > 0) activeId.value = next[0].id
  updateCellValue(next)
}

const triggerSelect = () => {
  fileInputRef.value?.click()
}

const removeFile = (id) => {
  const next = files.value.filter(item => item.id !== id)
  files.value = next
  if (activeId.value === id) {
    activeId.value = next[0]?.id || ''
  }
  updateCellValue(next)
}

const clearFiles = () => {
  files.value = []
  activeId.value = ''
  updateCellValue([])
}

const downloadFile = (item) => {
  const url = item.dataUrl || item.url
  if (!url) {
    ElMessage.warning('当前文件无法下载')
    return
  }
  const link = document.createElement('a')
  link.href = url
  link.download = item.name || '文件'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const closeDialog = () => {
  emit('update:visible', false)
}

watch(() => props.visible, (val) => {
  if (val) setFilesFromValue(props.params?.value)
})

watch(() => props.params, (val) => {
  if (props.visible && val) setFilesFromValue(val.value)
})
</script>

<style scoped>
.file-dialog-body {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 16px;
  min-height: 360px;
}

.file-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.file-limit {
  font-size: 12px;
  color: #909399;
}

.file-list {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  background: #fafafa;
  max-height: 360px;
  overflow-y: auto;
}

.file-empty {
  color: #909399;
  font-size: 12px;
  text-align: center;
  padding: 30px 0;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid transparent;
  margin-bottom: 8px;
}

.file-item:last-child {
  margin-bottom: 0;
}

.file-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.file-main {
  flex: 1;
  cursor: pointer;
}

.file-name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.file-meta {
  font-size: 12px;
  color: #909399;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-preview {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview-body {
  width: 100%;
  height: 100%;
}

.file-preview-img {
  width: 100%;
  height: 100%;
  max-height: 360px;
  object-fit: contain;
  border-radius: 4px;
}

.file-preview-pdf {
  width: 100%;
  height: 360px;
  border: none;
}

.file-preview-empty {
  text-align: center;
  color: #909399;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.file-preview-text {
  font-size: 13px;
}

.file-input {
  display: none;
}
</style>
