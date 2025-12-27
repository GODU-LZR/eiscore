<template>
  <div class="custom-header-wrapper">
    <div class="custom-header-main" @click="onLabelClick">
      <span class="custom-header-label">{{ params.displayName }}</span>
      <el-icon v-if="sortState === 'asc'" :size="12" color="#409EFF" style="margin-left:4px"><SortUp /></el-icon>
      <el-icon v-if="sortState === 'desc'" :size="12" color="#409EFF" style="margin-left:4px"><SortDown /></el-icon>
    </div>
    <div class="custom-header-tools">
      <span class="custom-header-icon lock-btn" @click.stop="onLockClick">
        <el-tooltip v-if="isLocked" :content="`列锁定: ${lockInfo}`" placement="top">
          <el-icon color="#F56C6C" :size="14"><Lock /></el-icon>
        </el-tooltip>
        <el-icon v-else class="header-unlock-icon" :size="14" color="#909399"><Unlock /></el-icon>
      </span>
      <span v-if="showMenu" class="custom-header-icon menu-btn" @click.stop="onMenuClick">
        <el-icon :size="14" color="#909399"><Filter /></el-icon>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElIcon, ElTooltip } from 'element-plus'
import { SortUp, SortDown, Lock, Unlock, Filter } from '@element-plus/icons-vue'

const props = defineProps(['params'])
const colId = props.params.column.colId
const gridComp = props.params.context.componentParent

const lockInfo = computed(() => gridComp.columnLockState[colId])
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
const onLockClick = () => gridComp.toggleColumnLock(colId)
</script>

<style scoped>
.custom-header-wrapper { display: flex; align-items: center; width: 100%; height: 100%; justify-content: space-between; }
.custom-header-main { display: flex; align-items: center; flex: 1; overflow: hidden; cursor: pointer; padding-right: 8px; }
.custom-header-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.custom-header-tools { display: flex; align-items: center; gap: 2px; }
.custom-header-icon { display: flex; align-items: center; padding: 4px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.custom-header-icon:hover { background-color: #e6e8eb; }
.header-unlock-icon, .menu-btn { opacity: 0; transition: opacity 0.2s; }
.custom-header-wrapper:hover .header-unlock-icon, .custom-header-wrapper:hover .menu-btn { opacity: 1; }
</style>
