<template>
  <el-cascader v-model="selected" :options="options" @change="apply" />
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps(['params'])
const selected = ref(props.params?.value)
const options = props.params?.colDef?.cascaderOptionsMap || []

const apply = () => {
  props.params?.setValue?.(selected.value)
}
</script>
