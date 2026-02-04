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
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElButton, ElIcon } from 'element-plus'
import { Document } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const isPinned = computed(() => !!props.params?.node?.rowPinned)

const onViewForm = () => {
  if (isPinned.value) return
  if (props.params.context.componentParent && props.params.context.componentParent.viewDocument) {
    props.params.context.componentParent.viewDocument(props.params.data)
  }
}
</script>

<style scoped>
.action-cell-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}
.action-btn {
  padding: 4px 8px;
  display: flex;
  align-items: center;
  font-weight: 500;
}
</style>
