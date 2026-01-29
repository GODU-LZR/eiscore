<template>
  <component :is="activeComponent" :key="appKey" :app-key="appKey" />
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MaterialManageView from './MaterialManageView.vue'
import { findMaterialApp } from '@/utils/material-apps'
import { hasPerm } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const appKey = computed(() => route.params.key)
const appConfig = computed(() => findMaterialApp(appKey.value))

watchEffect(() => {
  const perm = appConfig.value?.perm
  if (perm && !hasPerm(perm)) {
    router.replace('/apps')
  }
})
const activeComponent = computed(() => MaterialManageView)
</script>
