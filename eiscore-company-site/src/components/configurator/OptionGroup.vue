<template>
  <div class="option-group">
    <div class="option-group-heading">
      <strong>{{ title }}</strong>
      <span>{{ variants.length }} options</span>
    </div>
    <div class="swatch-grid">
      <button
        v-for="variant in variants"
        :key="variant.variantId"
        type="button"
        class="swatch-card"
        :class="{ selected: selectedId === variant.variantId }"
        :disabled="isCompatible && !isCompatible(slotName, variant.variantId)"
        :title="isCompatible && !isCompatible(slotName, variant.variantId) ? 'Incompatible with current configuration' : variant.displayName"
        @click="$emit('select', variant.variantId)"
      >
        <span class="swatch-color" :style="swatchStyle(variant)"></span>
        <span class="swatch-name">{{ variant.displayName }}</span>
        <small>{{ variant.displayNameZh }}</small>
        <em v-if="variant.priceLabel || variant.priceDelta">{{ variant.priceLabel || `+${variant.priceDelta}` }}</em>
      </button>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

defineProps({
  title: { type: String, default: '' },
  slotName: { type: String, default: '' },
  variants: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  isCompatible: { type: Function, default: null }
})

const swatchStyle = (variant) => ({
  backgroundColor: variant.color || '#b48a50',
  backgroundImage: variant.materialPreviewUrl ? `url(${variant.materialPreviewUrl})` : undefined,
  backgroundSize: 'cover',
  backgroundPosition: 'center'
})

defineEmits(['select'])
</script>

<style scoped>
.option-group { margin-top: 20px; }
.option-group-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
.option-group-heading strong { font-size: 13px; }
.option-group-heading span { color: var(--el-text-color-secondary); font-size: 11px; }
.swatch-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.swatch-card { position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 4px 9px; align-items: center; min-width: 0; padding: 9px; border: 1px solid var(--el-border-color); color: inherit; text-align: left; background: var(--el-bg-color); cursor: pointer; }
.swatch-card:hover, .swatch-card.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.swatch-card:disabled { cursor: not-allowed; opacity: .42; filter: grayscale(.35); }
.swatch-card:disabled:hover { border-color: var(--el-border-color); background: var(--el-bg-color); }
.swatch-color { grid-row: span 2; width: 32px; height: 32px; border: 1px solid rgba(0,0,0,.15); }
.swatch-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.swatch-card small { overflow: hidden; color: var(--el-text-color-secondary); text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.swatch-card em { position: absolute; top: 5px; right: 6px; color: var(--el-color-primary); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; font-style: normal; }
@media (max-width: 720px) { .swatch-grid { grid-template-columns: 1fr; } }
</style>
