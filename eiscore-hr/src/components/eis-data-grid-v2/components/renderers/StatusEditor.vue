<template>
  <div class="status-editor-popup" :style="{ width: cellWidth }">
    <div 
      v-for="opt in options" 
      :key="opt.value"
      class="status-editor-item"
      :class="{ 'is-selected': opt.value === selectedValue }"
      @click="onSelect(opt.value)"
    >
      <el-icon :color="opt.color" :size="16"><component :is="opt.icon" /></el-icon>
      <span class="status-label">{{ opt.label }}</span>
      <div v-if="opt.value === selectedValue" class="status-check-mark"></div>
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

<style scoped>
.status-editor-popup { background-color: #fff; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #e4e7ed; overflow: hidden; padding: 4px 0; }
.status-editor-item { display: flex; align-items: center; padding: 8px 12px; cursor: pointer; transition: background-color 0.2s; font-size: 13px; color: #606266; position: relative; }
.status-editor-item:hover { background-color: #f5f7fa; }
.status-editor-item.is-selected { background-color: #ecf5ff; color: #409EFF; font-weight: 500; }
.status-label { margin-left: 8px; flex: 1; }
.status-check-mark { width: 6px; height: 6px; border-radius: 50%; background-color: #409EFF; }
</style>
