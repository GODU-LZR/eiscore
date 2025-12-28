<template>
  <div class="document-action-cell">
    <el-tooltip content="查看单据" placement="top">
      <el-button
        class="document-action-button"
        type="primary"
        link
        :icon="Document"
        @click.stop="onViewDocument"
      />
    </el-tooltip>
  </div>
</template>

<script setup>
import { ElButton, ElTooltip } from 'element-plus'
import { Document } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const onViewDocument = () => {
  if (props.params.node.rowPinned) return
  const handler = props.params.context?.componentParent?.viewDocument
  if (handler) {
    handler(props.params.data)
  }
}
</script>

<style scoped>
.document-action-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.document-action-button {
  font-size: 16px;
}
</style>
