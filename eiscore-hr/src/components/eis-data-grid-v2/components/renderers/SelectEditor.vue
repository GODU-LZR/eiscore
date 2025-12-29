<template>
  <div class="select-editor-wrapper" @click.stop>
    <el-select
      ref="selectRef"
      v-model="internalValue"
      size="small"
      :placeholder="column.label"
      style="width: 100%"
      @change="handleChange"
      @visible-change="handleVisibleChange"
      automatic-dropdown
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: [String, Number, Boolean],
  column: {
    type: Object,
    required: true
  },
  row: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'done'])

const internalValue = ref(props.modelValue)
const selectRef = ref(null)

// 获取选项：支持静态 options
const options = computed(() => {
  return props.column.options || []
})

// 自动展开下拉框
onMounted(() => {
  nextTick(() => {
    selectRef.value?.focus()
    // 尝试触发展开，提升体验
    if(selectRef.value) {
      selectRef.value.toggleMenu()
    }
  })
})

const handleChange = (val) => {
  internalValue.value = val
  emit('update:modelValue', val)
  // 选择后立即完成编辑，体验更像 Excel
  emit('done')
}

// 当下拉框收起时，视为编辑结束
const handleVisibleChange = (visible) => {
  if (!visible) {
    emit('done')
  }
}
</script>

<style scoped>
.select-editor-wrapper {
  width: 100%;
}
/* 微调样式以贴合表格 */
:deep(.el-input__wrapper) {
  box-shadow: none !important;
  padding: 0 8px;
}
</style>