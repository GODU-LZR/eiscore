<template>
  <section class="document-engine">
    <header class="document-header">
      <h2 class="document-title">{{ schema?.title || '单据' }}</h2>
      <p v-if="schema?.subtitle" class="document-subtitle">{{ schema.subtitle }}</p>
    </header>

    <div class="document-body">
      <template v-for="(block, index) in schema?.layout || []" :key="index">
        <div v-if="block.type === 'row'" class="document-row">
          <div
            v-for="(cell, cellIndex) in block.children"
            :key="cellIndex"
            class="document-cell"
            :style="{ gridColumn: `span ${cell.span || 24}` }"
          >
            <div v-if="cell.label" class="document-label">{{ cell.label }}</div>
            <div class="document-value">
              {{ resolveText(cell.content || cell.text || cell.field) }}
            </div>
          </div>
        </div>

        <div v-else-if="block.type === 'table'" class="document-table">
          <div class="document-table-title">{{ block.label }}</div>
          <el-table
            :data="getTableData(block.field)"
            size="small"
            border
            class="document-table-grid"
          >
            <el-table-column
              v-for="(col, colIndex) in block.columns"
              :key="colIndex"
              :prop="col.field"
              :label="col.label"
              :width="col.width"
            />
          </el-table>
        </div>
      </template>
    </div>

    <footer v-if="schema?.footer" class="document-footer">
      {{ resolveText(schema.footer) }}
    </footer>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ElTable, ElTableColumn } from 'element-plus'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  schema: { type: Object, default: () => ({}) }
})

const dataSource = computed(() => props.modelValue || {})

const getValueByPath = (path) => {
  if (!path) return ''
  return path.split('.').reduce((acc, key) => acc?.[key], dataSource.value) ?? ''
}

const resolveText = (template) => {
  if (!template) return ''
  if (typeof template === 'string') {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
      return getValueByPath(key.trim())
    })
  }
  return getValueByPath(template)
}

const getTableData = (field) => {
  const data = getValueByPath(field)
  return Array.isArray(data) ? data : []
}
</script>

<style scoped>
.document-engine {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 16px;
  background: #fff;
  color: #303133;
  font-size: 13px;
  line-height: 1.5;
}

.document-header {
  text-align: center;
  margin-bottom: 12px;
}

.document-title {
  font-size: 18px;
  margin: 0;
}

.document-subtitle {
  margin: 4px 0 0;
  color: #909399;
}

.document-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.document-row {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 8px;
}

.document-cell {
  border: 1px solid #ebeef5;
  padding: 8px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.document-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.document-value {
  font-weight: 500;
  word-break: break-word;
}

.document-table-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.document-table-grid {
  width: 100%;
}

.document-footer {
  margin-top: 16px;
  text-align: right;
  color: #606266;
}

@media print {
  .document-engine {
    border: 1px solid #000;
    box-shadow: none;
  }
}
</style>
