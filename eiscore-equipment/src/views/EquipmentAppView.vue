<template>
  <EquipmentAppGrid :key="appKey" :app-key="appKey" :app-config="appConfig" />
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EquipmentAppGrid from '@/components/EquipmentAppGrid.vue'
import { findEquipmentApp } from '@/utils/equipment-apps'
import { hasPerm } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const appKey = computed(() => String(route.params.key || 'assets'))
const appConfig = computed(() => findEquipmentApp(appKey.value))

watchEffect(() => {
  if (!appConfig.value) {
    router.replace('/')
    return
  }
  const perm = appConfig.value?.perm
  if (perm && !hasPerm(perm)) router.replace('/')
})
</script>
