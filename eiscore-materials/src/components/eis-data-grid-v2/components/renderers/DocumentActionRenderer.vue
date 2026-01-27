<template>
  <div class="action-cell-wrapper" @mousedown.stop>
    <el-button 
      v-if="!isPinned"
      link 
      type="primary" 
      size="small" 
      class="action-btn"
      @click.stop="onViewForm"
    >
      <el-icon :size="14" style="margin-right: 4px; vertical-align: middle;"><Document /></el-icon>
      <span style="vertical-align: middle;">表单</span>
    </el-button>
    <el-button 
      v-if="!isPinned && hasLabelAction"
      link 
      type="primary" 
      size="small" 
      class="action-btn"
      @click.stop="onViewLabel"
    >
      <el-icon :size="14" style="margin-right: 4px; vertical-align: middle;"><Tickets /></el-icon>
      <span style="vertical-align: middle;">标签</span>
    </el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElButton, ElIcon } from 'element-plus'
import { Document, Tickets } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const isPinned = computed(() => !!props.params?.node?.rowPinned)
const hasLabelAction = computed(() => !!props.params?.context?.componentParent?.viewLabel)

const onViewForm = () => {
  if (isPinned.value) return
  // 确保 Context 存在
  if (props.params.context.componentParent && props.params.context.componentParent.viewDocument) {
    props.params.context.componentParent.viewDocument(props.params.data)
  } else {
    console.warn('viewDocument method not found on componentParent')
  }
}

const onViewLabel = () => {
  if (isPinned.value) return
  if (props.params.context.componentParent && props.params.context.componentParent.viewLabel) {
    props.params.context.componentParent.viewLabel(props.params.data)
  } else {
    console.warn('viewLabel method not found on componentParent')
  }
}
</script>

<style>
.action-cell-wrapper {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 100%;
  width: 100%;
  gap: 4px;
  flex-wrap: wrap;
}
.action-btn {
  padding: 4px 8px;
  display: flex;
  align-items: center;
  font-weight: 500;
}
.action-btn:hover {
  background-color: var(--el-color-primary-light-9);
  border-radius: 4px;
}
</style>
