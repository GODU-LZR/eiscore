<template>
  <component :is="activeComponent" :key="appKey" :app-key="appKey" :app-config="appConfig" />
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HrAppGrid from '@/components/HrAppGrid.vue'
import HrAttendanceView from './HrAttendanceView.vue'
import { findHrApp } from '@/utils/hr-apps'
import { hasPerm } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const appKey = computed(() => route.params.key)
const appConfig = computed(() => findHrApp(appKey.value))

watchEffect(() => {
  const perm = appConfig.value?.perm
  if (perm && !hasPerm(perm)) {
    router.replace('/apps')
  }
})

const activeComponent = computed(() => {
  if (appKey.value === 'c') return HrAttendanceView
  return HrAppGrid
})
</script>
