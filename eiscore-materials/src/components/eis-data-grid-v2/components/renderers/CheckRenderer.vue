<template>
  <span
    v-if="!isPinned"
    class="check-cell"
    :class="{ 'is-true': isTrue }"
    @click.stop="toggleValue"
  >{{ isTrue ? '✔' : '✘' }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])
const isTrue = computed(() => !!props.params?.value)
const isPinned = computed(() => !!props.params?.node?.rowPinned)

const toggleValue = () => {
  if (isPinned.value) return
  const params = props.params
  const colDef = params?.colDef || {}
  const editable = typeof colDef.editable === 'function'
    ? colDef.editable(params)
    : colDef.editable !== false
  if (!editable) return
  const field = colDef.field
  if (!field) return
  const nextVal = !isTrue.value
  params.node.setDataValue(field, nextVal)
  params.api?.stopEditing?.()
}
</script>

<style scoped>
.check-cell { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; width: 100%; }
.check-cell.is-true { color: #67c23a; }
.check-cell:not(.is-true) { color: #f56c6c; }
</style>
