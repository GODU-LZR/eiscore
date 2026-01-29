<template>
  <span class="check-editor">{{ nextValue ? '✔' : '✘' }}</span>
</template>

<script setup>
import { onMounted } from 'vue'

const props = defineProps(['params'])
const nextValue = !Boolean(props.params?.value)

const getValue = () => nextValue
defineExpose({ getValue })

onMounted(() => {
  props.params?.api?.stopEditing()
})
</script>

<style scoped>
.check-editor { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; width: 100%; }
</style>
