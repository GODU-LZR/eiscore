<template>
  <div class="custom-header-wrapper">
    <div class="custom-header-main" @click="onLabelClick">
      <span class="custom-header-label" :title="params.displayName">{{ params.displayName }}</span>
      <el-icon v-if="sortState === 'asc'" :size="12" color="#409EFF" style="margin-left:4px; flex-shrink: 0;"><SortUp /></el-icon>
      <el-icon v-if="sortState === 'desc'" :size="12" color="#409EFF" style="margin-left:4px; flex-shrink: 0;"><SortDown /></el-icon>
    </div>
    <div class="custom-header-tools">
      <span class="custom-header-icon lock-btn" @click.stop="onLockClick">
        <el-tooltip v-if="isLocked" :content="`列锁定: ${lockInfo}`" placement="top">
          <el-icon :size="14" class="header-lock-icon"><Lock /></el-icon>
        </el-tooltip>
        <el-icon v-else class="header-unlock-icon" :size="14"><Unlock /></el-icon>
      </span>
      <span v-if="showMenu" class="custom-header-icon menu-btn" @click.stop="onMenuClick">
        <el-icon :size="14" class="header-tool-icon"><Filter /></el-icon>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElIcon, ElTooltip } from 'element-plus'
import { SortUp, SortDown, Lock, Unlock, Filter } from '@element-plus/icons-vue'

const props = defineProps(['params'])
const colKey = props.params.column.getColDef().field || props.params.column.colId
const gridComp = props.params.context.componentParent

const lockInfo = computed(() => gridComp.columnLockState[colKey])
const isLocked = computed(() => !!lockInfo.value)
const showMenu = computed(() => props.params.enableMenu || props.params.column.isFilterAllowed())
const sortState = ref(null)

const onSortChanged = () => {
  if (props.params.column.isSortAscending()) sortState.value = 'asc'
  else if (props.params.column.isSortDescending()) sortState.value = 'desc'
  else sortState.value = null
}

onMounted(() => {
  props.params.column.addEventListener('sortChanged', onSortChanged)
  onSortChanged()
})

const onLabelClick = (e) => props.params.progressSort(e.shiftKey)
const onMenuClick = (e) => props.params.showColumnMenu(e.target)
const onLockClick = () => gridComp.toggleColumnLock(colKey)
</script>

<style>
/* 🟢 修复：去除 scoped，对齐原版样式 */
.custom-header-wrapper { display: flex; align-items: center; width: 100%; height: 100%; justify-content: space-between; overflow: hidden; }
.custom-header-main { display: flex; align-items: flex-start; flex: 1; overflow: hidden; cursor: pointer; padding-right: 4px; min-width: 0; }
.custom-header-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: clip; white-space: normal; font-weight: 600; font-size: 13px; color: var(--ag-header-foreground-color); line-height: 16px; word-break: break-all; }
.custom-header-tools { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.custom-header-icon { display: flex; align-items: center; padding: 4px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.custom-header-icon:hover { background-color: #e6e8eb; }
.header-unlock-icon, .menu-btn { opacity: 0; transition: opacity 0.2s; }
.custom-header-wrapper:hover .header-unlock-icon, .custom-header-wrapper:hover .menu-btn { opacity: 1; }
.header-tool-icon { color: var(--ag-header-foreground-color); }
.header-lock-icon { color: #f56c6c; }
</style>
