<template>
  <div class="status-editor-popup">
    <div
      v-for="item in options"
      :key="item.value"
      class="status-editor-item"
      :class="{ 'is-selected': item.value === current }"
      @click="select(item.value)"
    >
      <span class="status-label">{{ item.label }}</span>
      <span v-if="item.value === current" class="status-check-mark"></span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['params'])

const options = [
  { label: '草稿', value: 'created' },
  { label: '启用', value: 'active' },
  { label: '锁定', value: 'locked' }
]

const current = props.params?.value

const select = (value) => {
  props.params?.setValue?.(value)
}
</script>
