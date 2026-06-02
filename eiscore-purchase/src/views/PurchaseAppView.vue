<template>
  <PurchaseAppGrid :key="appKey" :app-key="appKey" :app-config="appConfig" />
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PurchaseAppGrid from '@/components/PurchaseAppGrid.vue'
import { findPurchaseApp } from '@/utils/purchase-apps'
import { hasPerm } from '@/utils/permission'

const route = useRoute()
const router = useRouter()

const appKey = computed(() => route.params.key || 'suppliers')
const appConfig = computed(() => findPurchaseApp(appKey.value))

watchEffect(() => {
  if (!appConfig.value) {
    router.replace('/apps')
    return
  }
  const perm = appConfig.value?.perm
  if (perm && !hasPerm(perm)) {
    router.replace('/apps')
  }
})
</script>
