<template>
  <component :is="activeComponent" :key="appKey" :app-key="appKey" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HrAppGrid from '@/components/HrAppGrid.vue'
import HrAttendanceView from './HrAttendanceView.vue'

const route = useRoute()
const appKey = computed(() => route.params.key)
const activeComponent = computed(() => {
  if (appKey.value === 'c') return HrAttendanceView
  return HrAppGrid
})
</script>
