<template>
  <div class="eis-document-paper">
    <div v-if="schema.title" class="doc-header">
      <h1 class="doc-title">{{ schema.title }}</h1>
      <div v-if="schema.docNo" class="doc-no">单据编号: {{ resolveValue(schema.docNo) || '自动生成' }}</div>
    </div>

    <div class="doc-body">
      <template v-for="(section, index) in schema.layout" :key="index">
        
        <div v-if="section.type === 'section'" class="doc-section">
          <div v-if="section.title" class="section-title">{{ section.title }}</div>
          <el-row class="grid-row">
            <el-col 
              v-for="(item, idx) in section.children" 
              :key="idx"
              :span="24 / (section.cols || 1)"
              class="grid-cell"
            >
              <div class="field-wrapper">
                <span v-if="item.label" class="field-label">{{ item.label }}:</span>
                
                <div class="field-content">
                  <span v-if="!item.widget || item.widget === 'text'">
                    {{ resolveValue(item.field, item.content) }}
                  </span>

                  <el-input 
                    v-else-if="item.widget === 'input'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    size="small"
                    :placeholder="item.placeholder"
                  />

                  <el-input
                    v-else-if="item.widget === 'textarea'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    type="textarea"
                    :rows="2"
                    size="small"
                    :placeholder="item.placeholder"
                  />

                  <el-date-picker
                    v-else-if="item.widget === 'date'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    type="date"
                    size="small"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                  />

                  <el-input-number
                    v-else-if="item.widget === 'number'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    size="small"
                    controls-position="right"
                    style="width: 100%"
                  />

                  <div v-else-if="item.widget === 'image'" class="image-field">
                    <el-image
                      v-if="resolveImageValue(item)"
                      :src="resolveImageValue(item)"
                      fit="contain"
                      class="image-preview"
                      :preview-src-list="[resolveImageValue(item)]"
                    />
                    <div v-else class="image-placeholder">未选择图片</div>
                    <div class="image-actions" v-if="imageOptions(item).length">
                      <el-select
                        size="small"
                        placeholder="选择图片"
                        :model-value="resolveImageValue(item)"
                        @change="(val) => updateValue(item.field, val)"
                      >
                        <el-option
                          v-for="opt in imageOptions(item)"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                      <el-button size="small" @click="updateValue(item.field, '')">清空</el-button>
                    </div>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div v-else-if="section.type === 'table'" class="doc-table-section">
          <div v-if="section.title" class="section-title">{{ section.title }}</div>
          <div v-if="section.allowAdd !== false" class="table-toolbar">
            <el-button size="small" @click="addTableRow(section)">新增一行</el-button>
          </div>
          <el-table 
            :data="resolveTableData(section.field)" 
            border 
            size="small" 
            style="width: 100%"
            class="custom-doc-table"
          >
            <el-table-column 
              v-for="(col, cIdx) in section.columns" 
              :key="cIdx"
              :prop="col.field"
              :label="col.label"
              :width="col.width"
              :align="col.align || 'center'"
            >
              <template #default="scope">
                <span v-if="!isTableEditable(section, col)">{{ scope.row[col.field] }}</span>
                <el-input
                  v-else-if="col.widget === 'input' || !col.widget"
                  size="small"
                  :model-value="scope.row[col.field]"
                  @update:modelValue="(val) => updateTableValue(section.field, scope.$index, col.field, val)"
                />
                <el-date-picker
                  v-else-if="col.widget === 'date'"
                  size="small"
                  type="date"
                  value-format="YYYY-MM-DD"
                  :model-value="scope.row[col.field]"
                  @update:modelValue="(val) => updateTableValue(section.field, scope.$index, col.field, val)"
                />
                <el-input-number
                  v-else-if="col.widget === 'number'"
                  size="small"
                  controls-position="right"
                  :model-value="scope.row[col.field]"
                  @update:modelValue="(val) => updateTableValue(section.field, scope.$index, col.field, val)"
                />
              </template>
            </el-table-column>
            <el-table-column
              v-if="section.allowDelete !== false"
              label="操作"
              width="70"
              align="center"
            >
              <template #default="scope">
                <el-button size="small" type="danger" link @click="removeTableRow(section.field, scope.$index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { ElRow, ElCol, ElInput, ElDatePicker, ElInputNumber, ElTable, ElTableColumn, ElImage, ElSelect, ElOption, ElButton } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    default: () => ({})
  },
  schema: {
    type: Object,
    required: true,
    default: () => ({ layout: [] })
  },
  fileOptions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

/**
 * 核心：智能数据解析器
 * 1. 优先读取 root 层级 (e.g., data.name)
 * 2. 失败则读取 properties 层级 (e.g., data.properties.weight)
 * 3. 支持插值字符串 (e.g., "含税: {{ price }}")
 */
const resolveValue = (field, contentTemplate) => {
  // 如果是纯展示模板 (e.g., content: "审核人: {{ auditor }}")
  if (contentTemplate) {
    return contentTemplate.replace(/\{\{(.+?)\}\}/g, (_, key) => {
      return getValueByPath(key.trim()) || ''
    })
  }
  
  // 如果绑定了字段
  if (field) {
    return getValueByPath(field)
  }
  
  return ''
}

const getValueByPath = (path, source = props.modelValue) => {
  if (!source || !path) return ''
  if (path in source) return source[path]
  if (source.properties && path in source.properties) return source.properties[path]
  const parts = path.split('.')
  if (parts.length > 1) {
    let current = source
    for (const part of parts) {
      if (current === null || current === undefined) return ''
      current = current[part]
    }
    return current
  }
  return ''
}

const normalizeImageValue = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) {
    const first = value[0]
    if (!first) return ''
    if (typeof first === 'string') return first
    if (typeof first === 'object') {
      return first.url || first.file_url || first.dataUrl || first.src || ''
    }
    return ''
  }
  if (typeof value === 'object') {
    return value.url || value.file_url || value.dataUrl || value.src || ''
  }
  return value
}

const resolveImageValue = (item) => {
  if (!item?.field) return ''
  const raw = getValueByPath(item.field, props.modelValue)
  return normalizeImageValue(raw)
}

const setValueByPath = (data, path, value) => {
  if (!data || !path) return
  if (path in data) {
    data[path] = value
    return
  }
  if (data.properties && path in data.properties) {
    data.properties[path] = value
    return
  }
  const parts = path.split('.')
  if (parts.length > 1) {
    let current = data
    parts.forEach((part, idx) => {
      if (idx === parts.length - 1) {
        current[part] = value
      } else {
        if (!current[part]) current[part] = {}
        current = current[part]
      }
    })
    return
  }
  if (!data.properties) data.properties = {}
  data.properties[path] = value
}

/**
 * 获取表格数组数据
 * 通常明细表数据存储在 properties.items 或者关联查询的子字段中
 */
const resolveTableData = (field) => {
  const data = getValueByPath(field, props.modelValue)
  return Array.isArray(data) ? data : []
}

/**
 * 数据更新回写
 * 同样需要处理 root 和 properties 的区别
 */
const updateValue = (field, value) => {
  const newData = JSON.parse(JSON.stringify(props.modelValue))
  setValueByPath(newData, field, value)
  emit('update:modelValue', newData)
}

const updateTableValue = (tableField, rowIndex, colField, value) => {
  const newData = JSON.parse(JSON.stringify(props.modelValue))
  const table = getValueByPath(tableField, newData)
  const nextTable = Array.isArray(table) ? table : []
  if (!nextTable[rowIndex]) nextTable[rowIndex] = {}
  nextTable[rowIndex][colField] = value
  setValueByPath(newData, tableField, nextTable)
  emit('update:modelValue', newData)
}

const addTableRow = (section) => {
  const newData = JSON.parse(JSON.stringify(props.modelValue))
  const table = getValueByPath(section.field, newData)
  const nextTable = Array.isArray(table) ? table : []
  const newRow = {}
  section.columns.forEach(col => {
    newRow[col.field] = ''
  })
  nextTable.push(newRow)
  setValueByPath(newData, section.field, nextTable)
  emit('update:modelValue', newData)
}

const removeTableRow = (tableField, rowIndex) => {
  const newData = JSON.parse(JSON.stringify(props.modelValue))
  const table = getValueByPath(tableField, newData)
  if (!Array.isArray(table)) return
  table.splice(rowIndex, 1)
  setValueByPath(newData, tableField, table)
  emit('update:modelValue', newData)
}

const isTableEditable = (section, col) => {
  if (section.editable === false) return false
  if (col.editable === false) return false
  return true
}

const appliedImageDefaults = new Set()

const imageOptions = (item) => {
  const list = []
  if (!Array.isArray(props.fileOptions) || props.fileOptions.length === 0) return list
  props.fileOptions.forEach(source => {
    if (item.fileSource && item.fileSource !== source.field) return
    const files = Array.isArray(source.files) ? source.files : []
    files.forEach(file => {
      if (!file.url) return
      list.push({
        label: `${source.label} - ${file.name || '图片'}`,
        value: file.url
      })
    })
  })
  return list
}

const collectImageItems = (layout = []) => {
  const items = []
  layout.forEach(section => {
    if (section?.type === 'section' && Array.isArray(section.children)) {
      section.children.forEach(child => {
        if (child?.widget === 'image' && child.field) {
          items.push(child)
        }
      })
    }
  })
  return items
}

const ensureImageDefaults = () => {
  const items = collectImageItems(props.schema?.layout || [])
  items.forEach(item => {
    if (!item.field) return
    const rawValue = getValueByPath(item.field, props.modelValue)
    const current = normalizeImageValue(rawValue)
    if (current) return
    if (appliedImageDefaults.has(item.field)) return
    if (Array.isArray(rawValue) && item.fileSource && item.fileSource === item.field) return
    const options = imageOptions(item)
    if (options.length > 0) {
      appliedImageDefaults.add(item.field)
      updateValue(item.field, options[0].value)
    }
  })
}

watch(
  () => [props.fileOptions, props.schema, props.modelValue],
  () => {
    ensureImageDefaults()
  },
  { deep: true, immediate: true }
)
</script>

<style scoped>
.eis-document-paper {
  background: #fff;
  padding: 20px 40px;
  border: 1px solid #dcdfe6;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  max-width: 900px;
  margin: 0 auto;
  font-family: "SimSun", "Songti SC", serif; /* 仿宋/宋体，更像凭证 */
  color: #000;
}

/* 标题区 */
.doc-header {
  text-align: center;
  margin-bottom: 20px;
  position: relative;
}
.doc-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #000;
  display: inline-block;
}
.doc-no {
  position: absolute;
  right: 0;
  top: 5px;
  font-size: 12px;
  font-family: sans-serif;
}

/* 栅格边框模拟 */
.grid-row {
  border-top: 1px solid #000;
  border-left: 1px solid #000;
}
.grid-cell {
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
}

/* 字段样式 */
.field-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}
.field-label {
  font-weight: bold;
  margin-right: 8px;
  white-space: nowrap;
  font-size: 14px;
}
.field-content {
  flex: 1;
  font-size: 14px;
}

.image-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.image-preview {
  width: 100%;
  max-height: 160px;
  border: 1px solid #000;
}

.image-placeholder {
  width: 100%;
  height: 120px;
  border: 1px dashed #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
}

.image-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 表格区域 */
.doc-table-section {
  margin-top: -1px; /* 边框重叠 */
}

.table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin: 6px 0;
}
.section-title {
  font-weight: bold;
  padding: 5px 0;
  border-bottom: 1px solid #000;
}

/* 覆盖 Element 样式以适应打印风格 */
:deep(.el-input__wrapper) {
  box-shadow: none !important;
  border-bottom: 1px dashed #999;
  border-radius: 0;
  padding: 0;
  background: transparent;
}
:deep(.el-input__inner) {
  text-align: left;
  color: #000;
}
:deep(.custom-doc-table) {
  --el-table-border-color: #000;
  --el-table-header-bg-color: #f5f5f5;
  --el-table-text-color: #000;
  border: 1px solid #000;
  border-bottom: none; /* 避免双重底边 */
}
:deep(.custom-doc-table th.el-table__cell) {
  font-weight: bold;
  color: #000;
  border-bottom: 1px solid #000 !important;
  border-right: 1px solid #000 !important;
}
:deep(.custom-doc-table td.el-table__cell) {
  border-bottom: 1px solid #000 !important;
  border-right: 1px solid #000 !important;
}

@media print {
  .table-toolbar,
  .image-actions,
  :deep(.el-button) {
    display: none !important;
  }
}
</style>
