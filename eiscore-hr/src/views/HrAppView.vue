<template>
  <HrAppGrid :key="appKey" :app-key="appKey" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HrAppGrid from '@/components/HrAppGrid.vue'

const route = useRoute()
const appKey = computed(() => route.params.key)
</script>
