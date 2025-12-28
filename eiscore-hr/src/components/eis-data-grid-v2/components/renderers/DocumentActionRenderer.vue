<template>
  <div class="action-cell-wrapper" @mousedown.stop>
    <el-button 
      link 
      type="primary" 
      size="small" 
      class="action-btn"
      @click.stop="onViewForm"
    >
      <el-icon :size="14" style="margin-right: 4px; vertical-align: middle;"><Document /></el-icon>
      <span style="vertical-align: middle;">表单</span>
    </el-button>
  </div>
</template>

<script setup>
import { ElButton, ElIcon } from 'element-plus'
import { Document } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const onViewForm = () => {
  // 确保 Context 存在
  if (props.params.context.componentParent && props.params.context.componentParent.viewDocument) {
    props.params.context.componentParent.viewDocument(props.params.data)
  } else {
    console.warn('viewDocument method not found on componentParent')
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