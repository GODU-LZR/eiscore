<template>
  <span class="check-cell" :class="{ 'is-true': isTrue }">{{ isTrue ? '✔' : '✘' }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])
const isTrue = computed(() => !!props.params?.value)
</script>

<style scoped>
.check-cell { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; width: 100%; }
.check-cell.is-true { color: #67c23a; }
.check-cell:not(.is-true) { color: #f56c6c; }
</style>
