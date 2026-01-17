<template>
  <div class="sheet-stack" :style="stackStyle">
    <div
      v-for="(item, index) in visibleItems"
      :key="itemKey(item, index)"
      class="sheet"
      :class="{ active: isActive(item) }"
      :style="sheetStyle(index, isActive(item))"
      @mouseenter="handleHover(item)"
      @click="handleHover(item)"
    >
      <div class="sheet-header">
        <slot name="header" :item="item" :active="isActive(item)">
          <div class="sheet-title">{{ item.title || item.label || '未命名' }}</div>
          <div v-if="item.subtitle" class="sheet-sub">{{ item.subtitle }}</div>
        </slot>
      </div>
      <div class="sheet-body" :class="{ inactive: !isActive(item) }">
        <slot :item="item" :active="isActive(item)" />
      </div>
      <div v-if="!isActive(item)" class="sheet-mask"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  modelValue: { type: [String, Number], default: '' },
  maxVisible: { type: Number, default: 4 },
  height: { type: [String, Number], default: '560px' },
  offsetX: { type: Number, default: 26 },
  offsetY: { type: Number, default: 16 },
  shrinkX: { type: Number, default: 28 },
  shrinkY: { type: Number, default: 16 },
  rotateStep: { type: Number, default: 1.6 },
  hoverActivate: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'change'])

const activeKey = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  activeKey.value = val
})

watch(
  () => props.items,
  (items) => {
    if (!items.length) return
    if (!activeKey.value) {
      activeKey.value = itemKey(items[0], 0)
      emit('update:modelValue', activeKey.value)
    }
  },
  { immediate: true }
)

const visibleItems = computed(() => {
  if (!props.items || props.items.length === 0) return []
  return props.items.slice(0, props.maxVisible)
})

const stackStyle = computed(() => {
  const height = typeof props.height === 'number' ? `${props.height}px` : props.height
  return {
    height
  }
})

const itemKey = (item, index) => {
  if (!item) return index
  return item.key ?? item.id ?? item.value ?? index
}

const isActive = (item) => {
  return itemKey(item, 0) === activeKey.value
}

const sheetStyle = (index, active) => {
  if (active) {
    return {
      zIndex: 20,
      transform: 'translate(0, 0) rotate(0deg) scale(1)',
      width: '100%',
      height: '100%'
    }
  }
  const x = index * props.offsetX
  const y = index * props.offsetY
  const rotate = props.rotateStep * (index % 2 === 0 ? -1 : 1)
  const width = `calc(100% - ${index * props.shrinkX}px)`
  const height = `calc(100% - ${index * props.shrinkY}px)`
  return {
    zIndex: index + 1,
    transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${1 - index * 0.03})`,
    width,
    height
  }
}

const handleHover = (item) => {
  if (!props.hoverActivate) return
  const key = itemKey(item, 0)
  if (key === activeKey.value) return
  activeKey.value = key
  emit('update:modelValue', key)
  emit('change', item)
}
</script>

<style scoped>
.sheet-stack {
  position: relative;
  width: 100%;
  padding: 10px 36px 30px 10px;
  box-sizing: border-box;
  perspective: 1200px;
}

.sheet {
  position: absolute;
  top: 0;
  left: 0;
  background: linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%);
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.1);
  transition: transform 0.25s ease, box-shadow 0.25s ease, z-index 0.2s ease;
  overflow: hidden;
}

.sheet.active {
  box-shadow: 0 26px 60px rgba(64, 158, 255, 0.2);
}

.sheet-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  background: #f7f9fc;
}

.sheet-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.sheet-sub {
  font-size: 12px;
  color: #909399;
}

.sheet-body {
  height: calc(100% - 49px);
  background: #fff;
  transition: opacity 0.2s ease;
}

.sheet-body.inactive {
  pointer-events: none;
  opacity: 0.45;
}

.sheet-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1));
  pointer-events: none;
}

@media (max-width: 768px) {
  .sheet-stack {
    padding: 8px 14px 20px 8px;
  }
  .sheet {
    border-radius: 8px;
  }
}
</style>
