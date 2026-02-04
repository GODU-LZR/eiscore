<template>
  <div class="acl-table">
    <el-table
      :data="data"
      border
      style="width: 100%"
      size="small"
      :header-cell-style="{ background: '#f8f9fb' }"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
      >
        <template #default="scope">
          <component
            :is="cellComponent(col)"
            :scope="scope"
            :col="col"
            :readonly="readonly"
            @input="onInput(scope.row, col, $event)"
            @toggle="onToggle(scope.row, col, $event)"
          />
        </template>
      </el-table-column>

      <el-table-column v-if="hasActions" fixed="right" label="操作" width="140">
        <template #default="scope">
          <el-button v-if="!readonly && canEdit(scope.row)" size="small" type="primary" text @click="emitUpdate(scope.row)">保存</el-button>
          <el-button v-if="!readonly && canDelete(scope.row)" size="small" type="danger" text @click="emitDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="showCreate && !readonly" class="create-bar">
      <el-button type="primary" size="small" @click="emitCreate">新增</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  columns: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false }
})
const emit = defineEmits(['create', 'update', 'delete', 'toggle'])

const hasActions = computed(() => props.columns.some(c => c.type === 'actions'))
const showCreate = computed(() => props.columns.some(c => c.type === 'actions'))

const cellComponent = (col) => {
  if (col.type === 'actions') return 'span'
  if (col.type === 'switch') return 'SwitchCell'
  if (col.type === 'select') return 'SelectCell'
  return 'TextCell'
}

const canEdit = (row) => true
const canDelete = (row) => true

const onInput = (row, col, value) => {
  if (props.readonly) return
  row[col.prop] = value
}
const onToggle = (row, col, value) => {
  if (props.readonly) return
  emit('toggle', row, value, col)
}

const emitCreate = () => emit('create', {})
const emitUpdate = (row) => emit('update', row)
const emitDelete = (row) => emit('delete', row)
</script>

<script>
// simple inline cell components
export default {
  components: {
    TextCell: {
      props: ['scope', 'col', 'readonly'],
      template: `
        <div>
          <el-input
            v-if="col.editable && !readonly"
            v-model="scope.row[col.prop]"
            size="small"
          />
          <span v-else>{{ scope.row[col.prop] }}</span>
        </div>
      `
    },
    SwitchCell: {
      props: ['scope', 'col', 'readonly'],
      emits: ['toggle'],
      template: `
        <el-switch
          :model-value="!!scope.row[col.prop]"
          :disabled="readonly"
          @change="$emit('toggle', $event)"
        />
      `
    },
    SelectCell: {
      props: ['scope', 'col', 'readonly'],
      template: `
        <el-select
          v-model="scope.row[col.prop]"
          size="small"
          :disabled="readonly"
          style="width: 100%"
        >
          <el-option
            v-for="opt in col.options || []"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      `
    }
  }
}
</script>

<style scoped>
.acl-table {
  width: 100%;
}
.create-bar {
  margin-top: 8px;
}
</style>
