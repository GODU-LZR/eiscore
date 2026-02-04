<template>
  <el-select v-model="selected" size="small" @change="apply">
    <el-option v-for="opt in options" :key="opt.value || opt.label" :label="opt.label" :value="opt.value" />
  </el-select>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps(['params'])
const selected = ref(props.params?.value)
const options = props.params?.colDef?.options || []

const apply = () => {
  props.params?.setValue?.(selected.value)
}

onMounted(() => {
  selected.value = props.params?.value
})
</script>
