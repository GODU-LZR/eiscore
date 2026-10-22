<template><div ref="outlet" class="harness-workspace-slot" /></template>

<script setup>
import { ref, watch, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { businessHarnessState } from '@/services/business-harness-controller'

const props = defineProps({ active: Boolean })
const outlet = ref(null)
const unregister = () => {
  if (businessHarnessState.workspace === outlet.value) businessHarnessState.workspace = null
}
const register = () => {
  if (props.active && outlet.value) businessHarnessState.workspace = outlet.value
  else unregister()
}

watch([() => props.active, outlet], register, { flush: 'post' })
onActivated(register)
onDeactivated(unregister)
onBeforeUnmount(unregister)
</script>

<style scoped>
.harness-workspace-slot { flex: 1; width: 100%; min-height: 0; }
</style>
