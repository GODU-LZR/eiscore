<template>
  <div class="custom-header-wrapper">
    <div class="custom-header-main" @click="onHeaderClick">
      <span class="custom-header-label">{{ params?.displayName }}</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['params'])

const onHeaderClick = (event) => {
  props.params?.context?.componentParent?.onHeaderLabelClick?.(props.params, event)
}
</script>
