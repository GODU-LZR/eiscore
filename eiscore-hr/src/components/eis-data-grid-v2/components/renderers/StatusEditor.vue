<template>
  <div class="eis-status-popup" :style="{ width: cellWidth }">
    <div 
      v-for="opt in options" 
      :key="opt.value"
      class="eis-status-item"
      :class="{ 'is-selected': opt.value === selectedValue }"
      @click="onSelect(opt.value)"
    >
      <el-icon :color="opt.color" :size="16" style="margin-right: 8px; display: flex; align-items: center;"><component :is="opt.icon" /></el-icon>
      <span class="eis-status-label">{{ opt.label }}</span>
      <div v-if="opt.value === selectedValue" class="eis-status-check"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElIcon } from 'element-plus'
import { Lock, CirclePlus, CircleCheck } from '@element-plus/icons-vue'

const props = defineProps(['params'])
const selectedValue = ref(props.params.value)
const cellWidth = ref('100px')

const options = [
  { value: 'created', label: '创建', color: '#409EFF', icon: CirclePlus },
  { value: 'active', label: '生效', color: '#67C23A', icon: CircleCheck },
  { value: 'locked', label: '锁定', color: '#F56C6C', icon: Lock }
]

onMounted(() => {
  if(props.params.column) cellWidth.value = props.params.column.getActualWidth() + 'px'
})

const onSelect = (val) => {
  selectedValue.value = val
  props.params.stopEditing()
}

defineExpose({ getValue: () => selectedValue.value })
</script>

<style>
.eis-status-popup { 
  background-color: #fff; 
  border-radius: 4px; 
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
  border: 1px solid #e4e7ed; 
  overflow: hidden; 
  padding: 4px 0;
  z-index: 9999; /* 防止被遮挡 */
}
.eis-status-item { 
  display: flex; 
  align-items: center; 
  padding: 8px 12px; 
  cursor: pointer; 
  transition: background-color 0.2s; 
  font-size: 13px; 
  color: #606266; 
  height: 36px; /* 固定高度 */
}
.eis-status-item:hover { background-color: #f5f7fa; }
.eis-status-item.is-selected { background-color: #ecf5ff; color: #409EFF; font-weight: 500; }
.eis-status-label { flex: 1; }
.eis-status-check { width: 6px; height: 6px; border-radius: 50%; background-color: #409EFF; }
</style>