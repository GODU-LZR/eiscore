<template>
  <aside class="knowledge-files-panel" aria-label="知识文件管理">
    <div class="panel-heading">
      <div>
        <p class="panel-kicker">知识文件</p>
        <h2>文件管理</h2>
      </div>
      <el-button class="icon-button" :loading="loading" title="刷新文件" aria-label="刷新文件" @click="loadFiles">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <div class="file-actions">
      <el-upload :show-file-list="false" :before-upload="handleUpload" :disabled="uploading" accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx">
        <el-button type="primary" plain :loading="uploading"><el-icon><Upload /></el-icon>上传文件</el-button>
      </el-upload>
      <el-select v-model="selectedFolder" clearable filterable allow-create default-first-option size="small" placeholder="全部文件夹" aria-label="按文件夹筛选或输入新文件夹">
        <el-option v-for="folder in folders" :key="folder" :label="folder" :value="folder" />
      </el-select>
    </div>

    <div v-if="error" class="panel-error" role="alert">{{ error }}</div>
    <div v-if="loading && !files.length" class="panel-empty">正在加载文件…</div>
    <div v-else-if="!filteredFiles.length" class="panel-empty">暂无知识文件</div>
    <ul v-else class="file-list">
      <li v-for="file in filteredFiles" :key="file.id" :class="['file-row', { selected: selectedId === file.id }]">
        <button class="file-select" type="button" @click="selectFile(file)">
          <el-icon><Document /></el-icon>
          <span class="file-copy"><strong>{{ file.file_name }}</strong><small>{{ folderName(file) }} · {{ formatSize(file.file_size) }}</small></span>
        </button>
        <el-dropdown trigger="click" @command="(command) => handleCommand(command, file)">
          <button class="more-button" type="button" :aria-label="`${file.file_name} 操作`" title="文件操作"><el-icon><MoreFilled /></el-icon></button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="move">移动到文件夹</el-dropdown-item>
              <el-dropdown-item command="edit" :disabled="!isTextFile(file)">编辑文本</el-dropdown-item>
              <el-dropdown-item command="download">下载</el-dropdown-item>
              <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </li>
    </ul>

    <el-dialog v-model="editorVisible" :title="editorMode === 'rename' ? '重命名文件' : '编辑文本文件'" width="min(620px, 92vw)" append-to-body>
      <el-input v-if="editorMode === 'rename'" v-model="editorName" maxlength="180" show-word-limit placeholder="文件名" />
      <el-input v-else v-model="editorText" type="textarea" :rows="14" maxlength="200000" show-word-limit placeholder="文件内容" />
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="previewVisible" title="文件预览" direction="ltr" size="min(520px, 92vw)" append-to-body @closed="clearPreviewUrl">
      <template v-if="selectedFile">
        <h3 class="preview-title">{{ selectedFile.file_name }}</h3>
        <p class="preview-meta">{{ selectedFile.file_type || '未知类型' }} · {{ formatSize(selectedFile.file_size) }}</p>
        <pre v-if="selectedFile.content_text" class="preview-content">{{ selectedFile.content_text }}</pre>
        <img v-else-if="previewKind === 'image' && previewUrl" class="preview-image" :src="previewUrl" :alt="selectedFile.file_name" />
        <iframe v-else-if="previewKind === 'pdf' && previewUrl" class="preview-pdf" :src="previewUrl" :title="`${selectedFile.file_name} 预览`" />
        <div v-else class="panel-empty">此文件没有可预览的文本内容，请下载查看。</div>
      </template>
    </el-drawer>
  </aside>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, MoreFilled, Refresh, Upload } from '@element-plus/icons-vue'
import {
  deleteKnowledgeFile,
  fileToKnowledgePayload,
  listKnowledgeFiles,
  readKnowledgeFile,
  updateKnowledgeFile,
  uploadKnowledgeFile
} from '@/services/knowledge-file-client'

const props = defineProps({ selectedFile: { type: Object, default: null } })
const emit = defineEmits(['select-file', 'file-updated'])

const files = ref([])
const loading = ref(false)
const uploading = ref(false)
const saving = ref(false)
const error = ref('')
const selectedFolder = ref('')
const selectedId = ref('')
const selectedFile = ref(null)
const previewUrl = ref('')
const previewKind = ref('')
const previewVisible = ref(false)
const editorVisible = ref(false)
const editorMode = ref('rename')
const editorName = ref('')
const editorText = ref('')

const folders = computed(() => [...new Set(['根目录', ...files.value.map(folderName)])].sort((a, b) => a.localeCompare(b)))
const filteredFiles = computed(() => selectedFolder.value
  ? files.value.filter((file) => folderName(file) === selectedFolder.value)
  : files.value)

const folderName = (file) => String(file?.metadata?.folder || '根目录')
const isTextFile = (file) => file?.file_type?.startsWith('text/') || /\.(csv|json|md|txt|xml|yaml|yml|log)$/i.test(file?.file_name || '')
const formatSize = (value) => {
  const size = Number(value) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const clearPreviewUrl = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewKind.value = ''
}

let selectionRequestId = 0

const createFileBlob = (file) => {
  if (file?.content_b64) {
    const binary = atob(file.content_b64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: file.file_type || 'application/octet-stream' })
  }
  return new Blob([file?.content_text || ''], { type: file?.file_type || 'text/plain;charset=utf-8' })
}

const loadFiles = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await listKnowledgeFiles()
    files.value = Array.isArray(result?.files) ? result.files : []
  } catch (cause) {
    error.value = cause?.message || '知识文件加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => props.selectedFile, (file) => {
  if (!file?.id) return
  files.value = files.value.map((item) => item.id === file.id ? { ...item, ...file } : item)
  if (selectedId.value === file.id) selectedFile.value = file
}, { deep: true })

const handleUpload = async (file) => {
  uploading.value = true
  error.value = ''
  try {
    const payload = await fileToKnowledgePayload(file, selectedFolder.value === '根目录' ? '' : selectedFolder.value)
    await uploadKnowledgeFile(payload)
    await loadFiles()
    ElMessage.success('文件已上传')
  } catch (cause) {
    error.value = cause?.message || '文件上传失败'
    ElMessage.error(error.value)
  } finally {
    uploading.value = false
  }
  return false
}

const selectFile = async (file) => {
  const requestId = ++selectionRequestId
  selectedId.value = file.id
  clearPreviewUrl()
  let nextFile = file
  try {
    const result = await readKnowledgeFile(file.id)
    nextFile = result?.file || file
  } catch {
    nextFile = file
  }
  if (requestId !== selectionRequestId || selectedId.value !== file.id) return
  selectedFile.value = nextFile
  if (!selectedFile.value.content_text) {
    const type = String(selectedFile.value.file_type || '')
    if (type.startsWith('image/')) previewKind.value = 'image'
    else if (type === 'application/pdf' || /\.pdf$/i.test(selectedFile.value.file_name || '')) previewKind.value = 'pdf'
    if (previewKind.value && (selectedFile.value.content_b64 || selectedFile.value.content_text)) {
      previewUrl.value = URL.createObjectURL(createFileBlob(selectedFile.value))
    }
  }
  emit('select-file', selectedFile.value)
  previewVisible.value = true
}

const handleCommand = async (command, file) => {
  try {
    if (command === 'download') {
      const full = await readKnowledgeFile(file.id)
      const blob = createFileBlob(full?.file || file)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = file.file_name
      link.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      return
    }
    if (command === 'delete') {
      await ElMessageBox.confirm(`确认删除“${file.file_name}”吗？`, '删除文件', { type: 'warning' })
      await deleteKnowledgeFile(file.id)
      if (selectedId.value === file.id) {
        selectedId.value = ''
        previewVisible.value = false
        selectedFile.value = null
        emit('select-file', null)
      }
      await loadFiles()
      ElMessage.success('文件已删除')
      return
    }
    if (command === 'move') {
      const { value } = await ElMessageBox.prompt('输入已有文件夹或新文件夹名称；留空移回根目录。', '移动文件', {
        inputValue: folderName(file) === '根目录' ? '' : folderName(file),
        inputMaxLength: 60,
        inputPattern: /^[^\\/\u0000-\u001f\u007f]*$/,
        inputErrorMessage: '文件夹名称不能包含斜线或控制字符'
      })
      const folder = value.trim()
      const result = await updateKnowledgeFile(file.id, { metadataPatch: { folder: folder || null } })
      if (selectedId.value === file.id) {
        selectedFile.value = result?.file || file
        emit('file-updated', selectedFile.value)
      }
      await loadFiles()
      ElMessage.success(folder ? `已移到“${folder}”` : '已移回根目录')
      return
    }
    editorMode.value = command
    selectedFile.value = file
    editorName.value = file.file_name
    if (command === 'edit') {
      const full = await readKnowledgeFile(file.id)
      editorText.value = full?.file?.content_text || ''
    }
    editorVisible.value = true
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause?.message || '文件操作失败')
  }
}

const saveEditor = async () => {
  if (!selectedFile.value) return
  saving.value = true
  try {
    const payload = editorMode.value === 'rename'
      ? { fileName: editorName.value.trim() }
      : { contentText: editorText.value }
    if (!payload.fileName && editorMode.value === 'rename') throw new Error('文件名不能为空')
    const result = await updateKnowledgeFile(selectedFile.value.id, payload)
    if (selectedId.value === selectedFile.value.id) {
      selectedFile.value = result?.file || { ...selectedFile.value, ...payload }
      emit('file-updated', selectedFile.value)
    }
    editorVisible.value = false
    await loadFiles()
    ElMessage.success('文件已保存')
  } catch (cause) {
    ElMessage.error(cause?.message || '文件保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadFiles)
onBeforeUnmount(clearPreviewUrl)
</script>

<style scoped>
.knowledge-files-panel { display: flex; min-width: 0; flex-direction: column; height: 100%; color: #253b42; background: #fff; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 14px 14px 10px; border-bottom: 1px solid #e5ecee; }
.panel-kicker { margin: 0 0 3px; color: #14766e; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
h2 { margin: 0; font-size: 16px; }
.icon-button, .more-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #d6e2e4; border-radius: 4px; color: #46636b; background: #fff; cursor: pointer; }
.icon-button { width: 30px; height: 30px; padding: 0; }
.file-actions { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #eef2f3; }
.file-list { overflow: auto; flex: 1; margin: 0; padding: 6px; list-style: none; }
.file-row { display: flex; align-items: center; gap: 3px; border-radius: 4px; }
.file-row.selected { background: #eaf6f4; }
.file-select { display: flex; min-width: 0; flex: 1; align-items: center; gap: 8px; padding: 9px 6px; border: 0; color: inherit; text-align: left; background: transparent; cursor: pointer; }
.file-select > .el-icon { flex: 0 0 auto; color: #2f8a82; }
.file-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.file-copy strong, .file-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-copy strong { font-size: 12px; font-weight: 600; }
.file-copy small, .preview-meta { color: #7d8e93; font-size: 11px; }
.more-button { width: 28px; height: 28px; margin-right: 4px; padding: 0; border-color: transparent; }
.panel-empty { display: grid; min-height: 120px; place-items: center; padding: 16px; color: #86979c; font-size: 12px; text-align: center; }
.panel-error { margin: 8px 10px; padding: 8px; border: 1px solid #f0c6c6; color: #a63d3d; background: #fff5f5; font-size: 12px; line-height: 1.5; }
.preview-title { margin: 0 0 6px; font-size: 17px; overflow-wrap: anywhere; }
.preview-meta { margin: 0 0 12px; }
.preview-content { max-height: calc(100vh - 170px); overflow: auto; margin: 0; padding: 12px; border: 1px solid #e2ebec; border-radius: 4px; color: #33474d; background: #f7fafb; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.preview-image { display: block; max-width: 100%; max-height: calc(100vh - 180px); object-fit: contain; }
.preview-pdf { display: block; width: 100%; height: calc(100vh - 160px); border: 1px solid #e2ebec; }
@media (max-width: 900px) { .file-actions { grid-template-columns: 1fr; } }
</style>
