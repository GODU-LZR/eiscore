<template>
  <span class="check-editor">{{ value ? '✔' : '✘' }}</span>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps(['params'])
const value = ref(!!props.params?.value)

const getValue = () => value.value
defineExpose({ getValue })

onMounted(() => {
  value.value = !value.value
  props.params?.api?.stopEditing()
})
</script>

<style scoped>
.check-editor { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; width: 100%; }
</style>
