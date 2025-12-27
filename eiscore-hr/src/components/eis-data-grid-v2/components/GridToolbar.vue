<template>
  <div class="grid-toolbar">
    <div class="left-tools">
      <el-input 
        :model-value="search"
        @update:modelValue="$emit('update:search', $event)"
        placeholder="搜索全表..." 
        style="width: 240px" 
        clearable
        @input="$emit('search')"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      
      <el-button-group class="ml-2">
        <el-button type="primary" plain icon="CirclePlus" @click="$emit('create')">新增行</el-button>
        <el-button type="primary" plain icon="Operation" @click="$emit('config-columns')">新增列</el-button>
        <el-button type="danger" plain icon="Delete" @click="$emit('delete')" :disabled="selectedCount === 0">
          删除选中 ({{ selectedCount }})
        </el-button>
        <el-button plain icon="Download" @click="$emit('export')">导出</el-button>
      </el-button-group>

      <div class="tip-text" v-if="rangeInfo.active">
        已选中: {{ realRangeRowCount }} 行 x {{ realRangeColCount }} 列
      </div>
    </div>
    
    <div class="toolbar-actions">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElInput, ElButton, ElButtonGroup, ElIcon } from 'element-plus'
import { Search, CirclePlus, Operation, Delete, Download } from '@element-plus/icons-vue'

const props = defineProps(['search', 'selectedCount', 'rangeInfo', 'gridApi'])
const emit = defineEmits(['update:search', 'search', 'create', 'config-columns', 'delete', 'export'])

const getColIndex = (colId) => {
  if (!props.gridApi) return -1
  const allCols = props.gridApi.getAllGridColumns()
  return allCols.findIndex(c => c.getColId() === colId)
}

const realRangeRowCount = computed(() => {
  if (!props.rangeInfo.active) return 0
  return Math.abs(props.rangeInfo.endRowIndex - props.rangeInfo.startRowIndex) + 1
})

const realRangeColCount = computed(() => {
  if (!props.rangeInfo.active) return 0
  const startIdx = getColIndex(props.rangeInfo.startColId)
  const endIdx = getColIndex(props.rangeInfo.endColId)
  if (startIdx === -1 || endIdx === -1) return 0
  return Math.abs(endIdx - startIdx) + 1
})
</script>

<style scoped>
.grid-toolbar { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--el-border-color-light); background-color: #f8f9fa; }
.left-tools { display: flex; align-items: center; }
.ml-2 { margin-left: 8px; }
.tip-text { margin-left: 12px; font-size: 12px; color: #909399; font-family: monospace; }
.toolbar-actions { display: flex; gap: 12px; }
</style>
