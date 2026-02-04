<template>
  <el-dialog
    :model-value="visible"
    width="1200px"
    title="文件"
    top="3vh"
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
          <video v-else-if="isVideo(activeFile)" :src="previewUrl(activeFile)" class="file-preview-media" controls />
          <audio v-else-if="isAudio(activeFile)" :src="previewUrl(activeFile)" class="file-preview-audio" controls />
          <iframe v-else-if="isDoc(activeFile)" :src="previewUrl(activeFile)" class="file-preview-doc"></iframe>
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
import request from '@/utils/request'

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

const defaultAccept = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.mp4', '.mp3']

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
const fileStoreMode = computed(() => colDef.value.fileStoreMode || 'list')
const fileUrlCache = new Map()


const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
  try {
    return JSON.parse(trimmed)
  } catch (e) {
    return null
  }
}

const toList = (value) => {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
  }
  if (typeof value === 'object') return [value]
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

const parseDataUrlMeta = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return { type: '', ext: '' }
  const match = dataUrl.match(/^data:([^;]+);base64,/i)
  if (!match) return { type: '', ext: '' }
  const type = match[1] || ''
  const ext = type.includes('/') ? type.split('/')[1] : ''
  return { type, ext }
}

const normalizeItem = (item) => {
  if (item === null || item === undefined) return null
  if (typeof item === 'string') {
    if (item.startsWith('data:')) {
      const meta = parseDataUrlMeta(item)
      const name = meta.ext ? `image.${meta.ext}` : '已上传文件'
      return { id: createId(), name, dataUrl: item, ext: meta.ext, type: meta.type }
    }
    if (item.startsWith('file:')) {
      const fileId = item.replace('file:', '')
      return { id: fileId || createId(), name: '已上传文件', url: item }
    }
    const ext = getExt(item)
    return { id: createId(), name: item, ext }
  }
  if (typeof item === 'object') {
    const name = item.name || item.fileName || item.filename || item.title || item.url || item.file_url || ''
    const dataUrl = item.dataUrl || item.data_url || item.base64 || ''
    const url = item.url || item.file_url || ''
    const size = item.size || item.fileSize || 0
    const type = item.type || item.mime || ''
    let ext = item.ext || getExt(name)
    if (!ext && dataUrl) {
      const meta = parseDataUrlMeta(dataUrl)
      ext = meta.ext
    }
    const resolvedName = name || (dataUrl ? (ext ? `image.${ext}` : '已上传文件') : '')
    return {
      id: item.id || item.uuid || createId(),
      name: resolvedName,
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

const fetchFileDataUrl = async (fileId) => {
  if (!fileId) return { dataUrl: '', name: '' }
  if (fileUrlCache.has(fileId)) return fileUrlCache.get(fileId)
  try {
    const res = await request({
      url: `/files?id=eq.${fileId}&select=content_base64,mime_type,filename`,
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    const row = Array.isArray(res) ? res[0] : null
    if (!row?.content_base64) return { dataUrl: '', name: '' }
    const mime = row.mime_type || 'application/octet-stream'
    const dataUrl = `data:${mime};base64,${row.content_base64}`
    const payload = { dataUrl, name: row.filename || '' }
    fileUrlCache.set(fileId, payload)
    return payload
  } catch (e) {
    return { dataUrl: '', name: '' }
  }
}

const hydrateFileItem = async (item) => {
  if (!item?.url || item.dataUrl) return item
  if (!item.url.startsWith('file:')) return item
  const fileId = item.url.replace('file:', '')
  const res = await fetchFileDataUrl(fileId)
  if (!res.dataUrl) return item
  const meta = parseDataUrlMeta(res.dataUrl)
  return {
    ...item,
    dataUrl: res.dataUrl,
    name: item.name || res.name || item.name,
    type: item.type || meta.type || '',
    ext: item.ext || meta.ext || getExt(res.name || item.name)
  }
}

const setFilesFromValue = (value) => {
  const list = toList(value)
    .map(normalizeItem)
    .filter(Boolean)
  files.value = list
  activeId.value = list[0]?.id || ''
  if (list.length > 0) {
    Promise.all(list.map(hydrateFileItem)).then((next) => {
      files.value = next
      if (!activeId.value) activeId.value = next[0]?.id || ''
    })
  }
}

const activeFile = computed(() => files.value.find(item => item.id === activeId.value) || null)

const setActive = (id) => {
  activeId.value = id
}

const isImage = (item) => {
  if (item?.dataUrl && String(item.dataUrl).startsWith('data:image/')) return true
  const ext = item.ext || getExt(item.name)
  if (item.type && item.type.startsWith('image/')) return true
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(String(ext).toLowerCase())
}

const isPdf = (item) => {
  if (item?.dataUrl && String(item.dataUrl).startsWith('data:application/pdf')) return true
  const ext = item.ext || getExt(item.name)
  if (item.type && item.type.includes('pdf')) return true
  return String(ext).toLowerCase() === 'pdf'
}

const isVideo = (item) => {
  const ext = item.ext || getExt(item.name)
  if (item.type && item.type.startsWith('video/')) return true
  return ['mp4', 'webm', 'ogg'].includes(String(ext).toLowerCase())
}

const isAudio = (item) => {
  const ext = item.ext || getExt(item.name)
  if (item.type && item.type.startsWith('audio/')) return true
  return ['mp3', 'wav', 'ogg', 'm4a'].includes(String(ext).toLowerCase())
}

const isDoc = (item) => {
  const ext = item.ext || getExt(item.name)
  return String(ext).toLowerCase() === 'doc'
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
  const storeMode = fileStoreMode.value
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
  if (storeMode === 'url') {
    const first = payload[0]
    const value = first?.url || first?.dataUrl || first?.name || ''
    props.params.node.setDataValue(field, value || null)
    return
  }
  if (storeMode === 'single') {
    const first = payload[0]
    const value = first?.dataUrl || first?.url || first?.name || ''
    props.params.node.setDataValue(field, value || null)
  } else {
    props.params.node.setDataValue(field, payload.length ? payload : null)
  }
}

const extractBase64 = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return ''
  const idx = dataUrl.indexOf(',')
  return idx >= 0 ? dataUrl.slice(idx + 1) : ''
}

const extractMime = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return ''
  const match = dataUrl.match(/^data:([^;]+);base64,/i)
  return match ? match[1] : ''
}

const uploadToDb = async (file, dataUrl) => {
  const contentBase64 = extractBase64(dataUrl)
  const mimeType = file.type || extractMime(dataUrl) || 'application/octet-stream'
  const res = await request({
    url: '/files',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
    data: {
      filename: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
      content_base64: contentBase64
    }
  })
  const row = Array.isArray(res) ? res[0] : res
  if (!row?.id) throw new Error('文件保存失败')
  return row
}

const deleteFromDb = async (fileId) => {
  if (!fileId) return
  try {
    await request({
      url: `/files?id=eq.${fileId}`,
      method: 'delete',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      // 对已不存在的文件返回 404 时直接视为成功，避免错误弹窗
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404
    })
    fileUrlCache.delete(fileId)
  } catch (e) {
    // ignore delete errors; user may not have permission
  }
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
      if (fileStoreMode.value === 'url') {
        const saved = await uploadToDb(file, dataUrl)
        newItems.push({
          id: saved.id,
          name: saved.filename || file.name,
          type: saved.mime_type || file.type || '',
          size: saved.size_bytes || file.size || 0,
          dataUrl,
          url: `file:${saved.id}`,
          ext: getExt(saved.filename || file.name),
          uploadedAt: saved.created_at || new Date().toISOString()
        })
      } else {
        newItems.push({
          id: createId(),
          name: file.name,
          type: file.type || '',
          size: file.size || 0,
          dataUrl,
          ext: getExt(file.name),
          uploadedAt: new Date().toISOString()
        })
      }
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
  const target = files.value.find(item => item.id === id)
  if (fileStoreMode.value === 'url' && target?.url?.startsWith('file:')) {
    deleteFromDb(target.url.replace('file:', ''))
  }
  const next = files.value.filter(item => item.id !== id)
  files.value = next
  if (activeId.value === id) {
    activeId.value = next[0]?.id || ''
  }
  updateCellValue(next)
}

const clearFiles = () => {
  if (fileStoreMode.value === 'url') {
    files.value.forEach(item => {
      if (item?.url?.startsWith('file:')) deleteFromDb(item.url.replace('file:', ''))
    })
  }
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
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
  min-height: 600px;
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
  max-height: 580px;
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
  max-height: 600px;
  object-fit: contain;
  border-radius: 4px;
}

.file-preview-pdf {
  width: 100%;
  height: 600px;
  border: none;
}

.file-preview-doc {
  width: 100%;
  height: 600px;
  border: none;
}

.file-preview-media {
  width: 100%;
  max-height: 600px;
}

.file-preview-audio {
  width: 100%;
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
