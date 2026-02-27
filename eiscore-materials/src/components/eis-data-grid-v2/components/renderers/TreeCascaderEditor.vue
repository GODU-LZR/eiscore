<template>
  <div class="tree-cascader-editor" :style="{ width: cellWidth }" @mousedown.stop>
    <el-cascader
      v-model="internalValue"
      :options="options"
      :props="cascaderProps"
      :clearable="false"
      filterable
      @change="handleChange"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElCascader } from 'element-plus'

const props = defineProps(['params'])

const internalValue = ref(props.params.value)
const cellWidth = ref(props.params.column ? props.params.column.getActualWidth() + 'px' : '100%')

const colDef = computed(() => props.params.colDef || {})
const options = computed(() => colDef.value.cascaderTreeOptions || [])

const cascaderProps = computed(() => ({
  value: 'id',
  label: 'name',
  children: 'children',
  emitPath: false,
  ...(colDef.value.cascaderProps || {})
}))

const handleChange = () => {
  props.params.stopEditing()
}

defineExpose({ getValue: () => internalValue.value })
</script>

<style scoped>
.tree-cascader-editor :deep(.el-cascader) {
  width: 100%;
}
</style>
