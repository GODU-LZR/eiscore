<template>
  <div id="preview-root">
    <component :is="DynamicComponent" v-if="DynamicComponent" />
    <div v-else class="loading-state">
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const draftId = route.params.draftId

const DynamicComponent = ref(null)

onMounted(async () => {
  // In production, this would load the generated component from the database
  // For now, load from a generated file path
  try {
    const module = await import(`../drafts/${draftId}/App.vue`)
    DynamicComponent.value = module.default
  } catch (error) {
    console.error('Failed to load draft component:', error)
  }
})
</script>

<style scoped>
#preview-root {
  width: 100%;
  height: 100vh;
  padding: 16px;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #999;
}
</style>
