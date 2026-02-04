<template>
  <el-dialog
    :model-value="visible"
    width="520px"
    :title="title"
    append-to-body
    destroy-on-close
    @close="emit('update:visible', false)"
  >
    <div v-if="type === 'label'">
      <el-form label-width="100px">
        <el-form-item label="合计标题">
          <el-input v-model="form.label" placeholder="例如：合计" />
        </el-form-item>
      </el-form>
    </div>

    <div v-else>
      <el-form label-width="100px">
        <el-form-item label="统计规则">
          <el-select v-model="form.rule">
            <el-option label="无" value="none" />
            <el-option label="求和" value="sum" />
            <el-option label="平均" value="avg" />
            <el-option label="计数" value="count" />
            <el-option label="最大" value="max" />
            <el-option label="最小" value="min" />
          </el-select>
        </el-form-item>
        <el-form-item label="合计别名">
          <el-input v-model="form.cellLabel" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="公式">
          <el-input v-model="form.expression" type="textarea" :rows="3" placeholder="使用 {列名} 组合" />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  type: { type: String, default: null },
  colId: { type: String, default: '' },
  currentRule: { type: String, default: 'none' },
  currentExpression: { type: String, default: '' },
  currentLabel: { type: String, default: '' },
  currentCellLabel: { type: String, default: '' },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'save'])

const form = reactive({
  label: '',
  rule: 'none',
  expression: '',
  cellLabel: ''
})

watch(
  () => [props.visible, props.type, props.currentRule, props.currentExpression, props.currentLabel, props.currentCellLabel],
  () => {
    form.label = props.currentLabel || ''
    form.rule = props.currentRule || 'none'
    form.expression = props.currentExpression || ''
    form.cellLabel = props.currentCellLabel || ''
  },
  { immediate: true }
)

const save = () => {
  emit('save', {
    label: form.label,
    rule: form.rule,
    expression: form.expression,
    cellLabel: form.cellLabel,
    tab: form.expression ? 'formula' : 'rule'
  })
}
</script>
