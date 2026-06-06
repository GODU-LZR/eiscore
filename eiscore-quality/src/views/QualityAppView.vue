<template>
  <QualityAppGrid :key="appKey" :app-key="appKey" :app-config="appConfig" />
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QualityAppGrid from '@/components/QualityAppGrid.vue'
import { findQualityApp } from '@/utils/quality-apps'
import { hasPerm } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const appKey = computed(() => String(route.params.key || 'inspections'))
const appConfig = computed(() => findQualityApp(appKey.value))

watchEffect(() => {
  if (!appConfig.value) {
    router.replace('/')
    return
  }
  const perm = appConfig.value?.perm
  if (perm && !hasPerm(perm)) router.replace('/')
})
</script>

