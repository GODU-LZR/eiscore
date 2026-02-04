<template>
  <el-checkbox v-model="checked" @change="toggle" />
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElCheckbox } from 'element-plus'

const props = defineProps(['params'])
const checked = ref(!!props.params?.value)

watch(
  () => props.params?.value,
  (val) => {
    checked.value = !!val
  }
)

const toggle = () => {
  props.params?.setValue?.(checked.value)
}
</script>
