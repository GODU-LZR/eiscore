<template>
  <el-checkbox v-model="checked" @change="apply" />
</template>

<script setup>
import { ref } from 'vue'
import { ElCheckbox } from 'element-plus'

const props = defineProps(['params'])
const checked = ref(!!props.params?.value)

const apply = () => {
  props.params?.setValue?.(checked.value)
}
</script>
