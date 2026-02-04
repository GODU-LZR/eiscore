<template>
  <el-dialog
    :model-value="visible"
    width="680px"
    title="列管理"
    append-to-body
    destroy-on-close
    @close="emit('update:visible', false)"
  >
    <el-empty description="列管理由外部实现" />
  </el-dialog>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible'])
</script>
