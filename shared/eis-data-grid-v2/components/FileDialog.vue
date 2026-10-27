<template>
  <el-dialog
    :model-value="visible"
    width="1200px"
    title="文件"
    top="3vh"
    destroy-on-close
    @close="closeDialog"
  >
    <div class="file-dialog-body" data-guide="file-dialog">
      <div class="file-panel">
        <div class="file-toolbar" data-guide="file-toolbar">
          <el-button
            type="primary"
            data-sop-action="file-upload"
            data-sop-title="上传附件"
            data-sop-desc="把当前业务字段需要的合同、照片、报告或凭证上传到附件列表。"
            data-sop-steps="先确认当前记录和附件字段|检查允许的文件类型、大小和数量|点击上传文件并选择本地文件|上传后在列表和预览区复核内容"
            @click="triggerSelect"
          >上传文件</el-button>
          <el-button
            data-sop-action="file-clear"
            data-sop-title="清空附件"
            data-sop-desc="移除当前字段的全部附件，通常只在确认需要重新上传时使用。"
            data-sop-steps="先确认当前字段所有附件都不再需要|点击清空|重新上传正确附件|回到表单保存记录"
            @click="clearFiles"
            :disabled="files.length === 0"
          >清空</el-button>
          <span class="file-limit">最多 {{ maxCount }} 个，单个不超过 {{ maxSizeMb }}MB</span>
        </div>
        <div
          class="file-list"
          :class="{ 'is-dragging': isDragging }"
          data-guide="file-list"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
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
              <el-button
                link
                type="primary"
                data-sop-action="file-download"
                data-sop-title="下载附件"
                data-sop-desc="下载当前附件做离线查看、复核或留档。"
                data-sop-steps="先在附件列表选中目标文件|点击下载|打开文件核对内容|如发现错误回到附件列表删除后重传"
                @click="downloadFile(item)"
              >下载</el-button>
              <el-button
                link
                type="danger"
                data-sop-action="file-delete"
                data-sop-title="删除附件"
                data-sop-desc="删除当前字段中的错误附件。删除前要确认该附件不是审批、质检、维修或对账所需证据。"
                data-sop-steps="先确认要删除的是错误文件|点击删除|检查列表剩余附件是否完整|回到表单保存记录"
                @click="removeFile(item.id)"
              >删除</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="file-preview" data-guide="file-preview">
        <div v-if="activeFile" class="file-preview-body">
          <img v-if="canPreview(activeFile) && activePreviewKind === 'image'" :src="previewUrl(activeFile)" alt="预览" class="file-preview-img" />
          <iframe v-else-if="canPreview(activeFile) && activePreviewKind === 'pdf'" :src="previewUrl(activeFile)" class="file-preview-pdf"></iframe>
          <video v-else-if="canPreview(activeFile) && activePreviewKind === 'video'" :src="previewUrl(activeFile)" class="file-preview-media" controls />
          <audio v-else-if="canPreview(activeFile) && activePreviewKind === 'audio'" :src="previewUrl(activeFile)" class="file-preview-audio" controls />
          <div v-else-if="previewLoading" class="file-preview-empty" role="status">正在加载预览…</div>
          <div v-else-if="['office', 'text'].includes(activePreviewKind) && officePreview?.kind === 'text'" class="file-preview-office file-preview-office-text">
            <strong>{{ officeLabel(activeFile) }}</strong>
            <pre>{{ officePreview.text }}</pre>
            <el-button type="primary" @click="downloadFile(activeFile)">下载文件</el-button>
          </div>
          <div v-else-if="activePreviewKind === 'office' && officePreview?.kind === 'table'" class="file-preview-office file-preview-office-table">
            <div v-for="sheet in officePreview.sheets" :key="sheet.name" class="office-sheet">
              <strong>{{ sheet.name }}</strong>
              <div class="office-table-scroll">
                <table>
                  <tbody>
                    <tr v-for="(row, rowIndex) in sheet.rows" :key="`${sheet.name}-${rowIndex}`">
                      <td v-for="(cell, cellIndex) in row" :key="`${sheet.name}-${rowIndex}-${cellIndex}`">{{ cell }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <el-button type="primary" @click="downloadFile(activeFile)">下载文件</el-button>
          </div>
          <div v-else-if="['office', 'text'].includes(activePreviewKind)" class="file-preview-office">
            <el-icon :size="42"><Document /></el-icon>
            <strong>{{ officeLabel(activeFile) }}</strong>
            <span>{{ officePreviewError ? '预览失败，文件已安全保存，可下载后打开。' : '此格式暂不支持内容预览，文件已安全保存，可下载后打开。' }}</span>
            <el-button type="primary" @click="downloadFile(activeFile)">下载文件</el-button>
          </div>
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
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

// Shared by all EIS Data Grid v2 consumers.

import { ref, computed, watch } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { getAuthHeader } from '@/utils/auth'
import {
  resolveFilePreviewKind,
  selectFilesForUpload,
  serializeFileItem,
  shouldDeleteStoredFile,
  shouldUploadFileToDatabase
} from '../file-dialog-policy.mjs'

const props = defineProps({
  visible: { type: Boolean, default: false },
  params: { type: Object, default: null }
})

const emit = defineEmits(['update:visible'])

const files = ref([])
const activeId = ref('')
const fileInputRef = ref(null)
const isDragging = ref(false)
const previewLoading = ref(false)
const officePreview = ref(null)
const officePreviewError = ref(false)

const colDef = computed(() => props.params?.colDef || {})
const maxCount = computed(() => Math.max(1, Number(colDef.value.fileMaxCount) || 3))
const maxSizeMb = computed(() => Math.max(1, Number(colDef.value.fileMaxSizeMb) || 20))

const defaultAccept = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.mp4', '.mp3']

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
const pendingFileHydrations = new Map()


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
  if (pendingFileHydrations.has(fileId)) return pendingFileHydrations.get(fileId)
  const pending = (async () => {
    try {
      const response = await fetch(`/agent/ai/harness/files/read?id=${encodeURIComponent(fileId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { ...getAuthHeader() }
      })
      if (!response.ok) return { dataUrl: '', name: '' }
      const row = await response.json().catch(() => null)
      if (!row?.content_base64) return { dataUrl: '', name: '' }
      const mime = row.mime_type || 'application/octet-stream'
      const dataUrl = `data:${mime};base64,${row.content_base64}`
      const payload = { dataUrl, name: row.filename || '' }
      fileUrlCache.set(fileId, payload)
      return payload
    } catch (e) {
      return { dataUrl: '', name: '' }
    } finally {
      pendingFileHydrations.delete(fileId)
    }
  })()
  pendingFileHydrations.set(fileId, pending)
  return pending
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

const loadOfficePreviewFor = async (item) => {
  const loader = colDef.value.officePreviewLoader
  if (!item || typeof loader !== 'function') return
  const targetId = item.id
  previewLoading.value = activeId.value === targetId
  officePreview.value = null
  officePreviewError.value = false
  try {
    const hydrated = await hydrateFileItem(item)
    files.value = files.value.map(current => current.id === targetId ? hydrated : current)
    const result = await loader({ item: hydrated, dataUrl: hydrated.dataUrl || '' })
    if (activeId.value === targetId) officePreview.value = result || null
  } catch {
    if (activeId.value === targetId) officePreviewError.value = true
  } finally {
    if (activeId.value === targetId) previewLoading.value = false
  }
}

const loadPreviewFor = async (item) => {
  const kind = resolveFilePreviewKind(item)
  if (kind === 'office' || kind === 'text') {
    void loadOfficePreviewFor(item)
    return
  }
  if (!item?.url || item.dataUrl || !item.url.startsWith('file:')) return
  if (!['image', 'pdf', 'video', 'audio'].includes(kind)) return
  const targetId = item.id
  previewLoading.value = activeId.value === targetId
  const hydrated = await hydrateFileItem(item)
  files.value = files.value.map(current => current.id === targetId ? hydrated : current)
  if (activeId.value === targetId) previewLoading.value = false
}

const setFilesFromValue = (value) => {
  fileUrlCache.clear()
  const list = toList(value)
    .map(normalizeItem)
    .filter(Boolean)
  files.value = list
  activeId.value = list[0]?.id || ''
  previewLoading.value = false
  officePreview.value = null
  officePreviewError.value = false
  if (list.length > 0) void loadPreviewFor(list[0])
}

const activeFile = computed(() => files.value.find(item => item.id === activeId.value) || null)
const activePreviewKind = computed(() => resolveFilePreviewKind(activeFile.value))

const setActive = (id) => {
  fileUrlCache.clear()
  files.value = files.value.map(item => item.url?.startsWith('file:') ? { ...item, dataUrl: '' } : item)
  activeId.value = id
  previewLoading.value = false
  officePreview.value = null
  officePreviewError.value = false
  void loadPreviewFor(files.value.find(item => item.id === id))
}

const officeLabel = (item) => {
  const ext = String(item?.ext || getExt(item?.name)).toUpperCase()
  return ext ? `${ext} 文件` : '办公文件'
}

const isSafeResourceUrl = (value) => {
  const url = String(value || '').trim()
  if (!url) return false
  if (/^(?:data|blob):/i.test(url)) return true
  if (/^https?:\/\//i.test(url)) return true
  if (url.startsWith('/')) return true
  return false
}

const previewUrl = (item) => {
  const url = item?.dataUrl || item?.url || ''
  return isSafeResourceUrl(url) ? url : ''
}

const canPreview = (item) => !!previewUrl(item)

const formatSize = (size) => {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
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
  const payload = list.map(serializeFileItem)
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

const uploadReferenceFile = async (file) => {
  const response = await fetch('/agent/ai/harness/files/upload', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      ...getAuthHeader(),
      'content-type': String(file.type || 'application/octet-stream').slice(0, 160),
      'x-eiscore-file-name': encodeURIComponent(String(file.name || '').slice(0, 240))
    },
    body: file
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 413) throw new Error('文件请求超过服务上限，请使用20MB以内文件')
    throw new Error(String(body?.message || '文件保存失败'))
  }
  if (!body?.id) throw new Error('文件保存结果无效')
  return body
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

const deleteReferenceFile = async (fileId) => {
  if (!fileId) return
  try {
    await fetch(`/agent/ai/harness/files/delete?id=${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { ...getAuthHeader() }
    })
    fileUrlCache.delete(fileId)
  } catch {}
}

const processFiles = async (picked) => {
  if (picked.length === 0) return

  const remaining = maxCount.value - files.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多只能上传 ${maxCount.value} 个文件`)
    return
  }

  const { accepted, skippedType, skippedSize, skippedCount } = selectFilesForUpload(picked, {
    currentCount: files.value.length,
    maxCount: maxCount.value,
    maxSizeBytes: maxSizeMb.value * 1024 * 1024,
    acceptRules: acceptRules.value
  })

  if (skippedType > 0) ElMessage.warning('有文件格式不支持，已忽略')
  if (skippedSize > 0) ElMessage.warning(`有文件超过 ${maxSizeMb.value}MB，已忽略`)
  if (skippedCount > 0) ElMessage.warning(`附件数量超过上限，已忽略 ${skippedCount} 个`)
  if (accepted.length === 0) return

  const newItems = []
  for (const file of accepted) {
    try {
      const referenceMode = fileStoreMode.value === 'reference-list'
      const dataUrl = referenceMode ? '' : await readFileAsDataUrl(file)
      if (referenceMode) {
        const saved = await uploadReferenceFile(file)
        newItems.push({
          id: saved.id,
          name: saved.filename || file.name,
          type: saved.mime_type || file.type || '',
          size: saved.size_bytes || file.size || 0,
          url: `file:${saved.id}`,
          ext: getExt(saved.filename || file.name),
          uploadedAt: saved.created_at || new Date().toISOString()
        })
      } else if (shouldUploadFileToDatabase(fileStoreMode.value)) {
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
      ElMessage.warning(`文件读取或上传失败：${file.name}`)
    }
  }

  const next = [...files.value, ...newItems]
  files.value = next
  if (!activeId.value && next.length > 0) {
    activeId.value = next[0].id
    void loadPreviewFor(next[0])
  }
  updateCellValue(next)
}

const handleFileInput = async (event) => {
  const input = event.target
  const picked = Array.from(input.files || [])
  input.value = ''
  await processFiles(picked)
}

const handleDragLeave = (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) isDragging.value = false
}

const handleDrop = async (event) => {
  isDragging.value = false
  await processFiles(Array.from(event.dataTransfer?.files || []))
}

const triggerSelect = () => {
  fileInputRef.value?.click()
}

const removeFile = (id) => {
  const target = files.value.find(item => item.id === id)
  if (target?.url?.startsWith('file:')) fileUrlCache.delete(target.url.replace('file:', ''))
  if (shouldDeleteStoredFile(fileStoreMode.value, target)) {
    const fileId = target.url.replace('file:', '')
    if (fileStoreMode.value === 'reference-list') deleteReferenceFile(fileId)
    else deleteFromDb(fileId)
  }
  const next = files.value.filter(item => item.id !== id)
  files.value = next
  if (activeId.value === id) {
    activeId.value = next[0]?.id || ''
    previewLoading.value = false
    officePreview.value = null
    officePreviewError.value = false
    void loadPreviewFor(next[0])
  }
  updateCellValue(next)
}

const clearFiles = () => {
  files.value.filter(item => shouldDeleteStoredFile(fileStoreMode.value, item))
    .forEach(item => {
      const fileId = item.url.replace('file:', '')
      if (fileStoreMode.value === 'reference-list') deleteReferenceFile(fileId)
      else deleteFromDb(fileId)
    })
  files.value = []
  fileUrlCache.clear()
  activeId.value = ''
  previewLoading.value = false
  officePreview.value = null
  officePreviewError.value = false
  updateCellValue([])
}

const downloadFile = async (item) => {
  if (item?.url?.startsWith('file:') && !item.dataUrl) {
    const hydrated = await hydrateFileItem(item)
    if (!hydrated.dataUrl) {
      ElMessage.warning('文件读取失败，请稍后重试')
      return
    }
    return downloadFile(hydrated)
  }
  const url = item.dataUrl || item.url
  if (!isSafeResourceUrl(url)) {
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
  fileUrlCache.clear()
  files.value = files.value.map(item => item.url?.startsWith('file:') ? { ...item, dataUrl: '' } : item)
  previewLoading.value = false
  officePreview.value = null
  officePreviewError.value = false
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

.file-list.is-dragging {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, .18);
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

.file-preview-office {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: #606266;
}

.file-preview-office span {
  max-width: 320px;
  font-size: 13px;
  line-height: 1.6;
}

.file-preview-office-text,
.file-preview-office-table {
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
  overflow: auto;
  max-height: 600px;
}

.file-preview-office-text strong,
.file-preview-office-table > .el-button {
  align-self: flex-start;
}

.file-preview-office-text pre {
  margin: 0;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #f8fafc;
  color: #303133;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.office-sheet {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.office-table-scroll {
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.office-table-scroll table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.office-table-scroll td {
  min-width: 90px;
  padding: 7px 8px;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  color: #303133;
  white-space: pre-wrap;
  vertical-align: top;
}

.file-preview-text {
  font-size: 13px;
}

.file-input {
  display: none;
}
</style>
