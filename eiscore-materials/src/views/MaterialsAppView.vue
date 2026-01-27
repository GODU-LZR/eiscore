<template>
  <component :is="activeComponent" :key="appKey" :app-key="appKey" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MaterialManageView from './MaterialManageView.vue'

const route = useRoute()
const appKey = computed(() => route.params.key)
const activeComponent = computed(() => MaterialManageView)
</script>
