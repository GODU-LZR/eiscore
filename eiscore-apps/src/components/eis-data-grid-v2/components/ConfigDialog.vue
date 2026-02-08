<template>
  <el-dialog
    :model-value="visible"
    @update:modelValue="$emit('update:visible', $event)"
    :title="title"
    width="480px"
    align-center
    destroy-on-close
    append-to-body
    class="eis-config-dialog"
  >
    <div class="config-dialog-content">
      <template v-if="type === 'data'">
        <el-tabs v-model="internalTab" class="config-tabs">
          <el-tab-pane label="基础统计" name="basic">
            <p class="dialog-tip">
              <b>变量取值规则：</b><br>
              <span style="font-size: 12px; color: #909399;">
                定义该列在公式中的基础值。默认"不显示"。
              </span>
            </p>
            <el-radio-group v-model="internalRule" class="agg-radio-group">
              <el-radio v-for="opt in aggOptions" :key="opt.value" :value="opt.value" border>
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
            <div class="cell-label-block">
              <span class="cell-label-title">合计显示名称：</span>
              <el-input v-model="internalCellLabel" placeholder="比如：员工" clearable />
              <span class="cell-label-tip">显示效果：员工：123</span>
            </div>
          </el-tab-pane>

          <el-tab-pane label="高级公式" name="formula">
            <p class="dialog-tip">
              <b>列间运算公式：</b><br>
              <span style="font-size: 12px; color: #909399;">例如: <code>{基本工资} + {岗位津贴}</code></span>
            </p>
            <div class="formula-actions">
              <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
              <span class="formula-tip">支持复杂公式</span>
            </div>
            <el-input 
              v-model="internalExpression" 
              type="textarea" :rows="3"
              placeholder="在此输入公式..."
            />
            <div class="variable-tags">
              <span class="tag-label">点击插入变量:</span>
              <div class="tags-container">
                <el-tag v-for="col in columns" :key="col.prop" size="small" class="variable-tag" @click="insertVariable(col.label)">
                  {{ col.label }}
                </el-tag>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <template v-else-if="type === 'label'">
        <p class="dialog-tip">自定义底部合计行的名称：</p>
        <el-input v-model="internalLabel" placeholder="例如：本月总计" clearable @keyup.enter="handleSave"/>
      </template>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSave">保存配置</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { ElDialog, ElTabs, ElTabPane, ElRadioGroup, ElRadio, ElInput, ElButton, ElTag } from 'element-plus'
import { pushAiCommand, pushAiContext } from '@/utils/ai-context'

const props = defineProps(['visible', 'title', 'type', 'colId', 'currentRule', 'currentExpression', 'currentLabel', 'currentCellLabel', 'columns', 'loading'])
const emit = defineEmits(['update:visible', 'save'])

const internalTab = ref('basic')
const internalRule = ref('')
const internalExpression = ref('')
const internalLabel = ref('')
const internalCellLabel = ref('')

const aggOptions = [
  { label: '求和', value: 'sum' }, { label: '计数', value: 'count' }, { label: '平均', value: 'avg' },
  { label: '最大', value: 'max' }, { label: '最小', value: 'min' }, { label: '不显示', value: 'none' } 
]

watch(() => props.visible, (val) => {
  if (val) {
    internalRule.value = props.currentRule || 'none'
    internalExpression.value = props.currentExpression || ''
    internalLabel.value = props.currentLabel || ''
    internalCellLabel.value = props.currentCellLabel || ''
    internalTab.value = props.currentExpression ? 'formula' : 'basic'
  }
})

const insertVariable = (label) => {
  internalExpression.value += `{${label}}`
}

const buildFormulaPrompt = () => {
  const colName = props.title || '合计公式'
  const variables = Array.isArray(props.columns)
    ? props.columns.map(col => col.label).join('、')
    : ''
  return [
    '请帮我生成表格“合计/统计公式”。',
    `目标列：${colName}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{工资}+{绩效}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

const openAiFormula = () => {
  pushAiContext({
    app: 'app_center',
    view: 'summary_formula',
    aiScene: 'summary_formula',
    allowFormulaOnce: true,
    columns: Array.isArray(props.columns) ? props.columns : []
  })
  pushAiCommand({
    id: `summary_formula_${Date.now()}`,
    type: 'open-worker',
    prompt: buildFormulaPrompt()
  })
}

const handleApplyFormula = (event) => {
  if (!props.visible) return
  if (internalTab.value !== 'formula') return
  const formula = event?.detail?.formula
  if (!formula) return
  internalExpression.value = formula
}

const handleSave = () => {
  emit('save', {
    rule: internalRule.value,
    expression: internalExpression.value,
    label: internalLabel.value,
    cellLabel: internalCellLabel.value,
    tab: internalTab.value
  })
}

onMounted(() => {
  window.addEventListener('eis-ai-apply-formula', handleApplyFormula)
})

onUnmounted(() => {
  window.removeEventListener('eis-ai-apply-formula', handleApplyFormula)
})
</script>

<style scoped>
.dialog-tip { margin-bottom: 12px; color: #606266; font-size: 13px; line-height: 1.5; }
.agg-radio-group { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.cell-label-block { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.cell-label-title { font-size: 12px; color: #606266; }
.cell-label-tip { font-size: 12px; color: #909399; }
.variable-tags { margin-top: 15px; }
.tag-label { font-size: 12px; color: #909399; margin-bottom: 8px; display: block; }
.tags-container { display: flex; flex-wrap: wrap; gap: 8px; }
.variable-tag { cursor: pointer; }
.variable-tag:hover { opacity: 0.8; }
.formula-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.formula-tip { font-size: 12px; color: #909399; }

:global(#app.dark) .dialog-tip,
:global(#app.dark) .cell-label-title,
:global(#app.dark) .cell-label-tip,
:global(#app.dark) .tag-label,
:global(#app.dark) .formula-tip {
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-dialog) {
  background-color: #0f172a;
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-dialog__title),
:global(#app.dark) :deep(.el-radio__label),
:global(#app.dark) :deep(.el-tab-pane),
:global(#app.dark) :deep(.el-tabs__item) {
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-tabs__active-bar) {
  background-color: #f3f4f6;
}
:global(#app.dark) :deep(.el-input__wrapper),
:global(#app.dark) :deep(.el-textarea__inner) {
  background-color: #0b0f14;
  border-color: #1f2937;
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-input__inner) {
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-button:not(.is-text):not(.is-link)) {
  background-color: #0f172a;
  border-color: #1f2937;
  color: #f3f4f6;
}
</style>
