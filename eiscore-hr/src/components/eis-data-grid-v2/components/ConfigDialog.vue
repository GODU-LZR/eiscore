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
              <el-radio v-for="opt in aggOptions" :key="opt.value" :label="opt.value" border>
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </el-tab-pane>

          <el-tab-pane label="高级公式" name="formula">
            <p class="dialog-tip">
              <b>列间运算公式：</b><br>
              <span style="font-size: 12px; color: #909399;">例如: <code>{基本工资} + {岗位津贴}</code></span>
            </p>
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
import { ref, watch } from 'vue'
import { ElDialog, ElTabs, ElTabPane, ElRadioGroup, ElRadio, ElInput, ElButton, ElTag } from 'element-plus'

const props = defineProps(['visible', 'title', 'type', 'colId', 'currentRule', 'currentExpression', 'currentLabel', 'columns', 'loading'])
const emit = defineEmits(['update:visible', 'save'])

const internalTab = ref('basic')
const internalRule = ref('')
const internalExpression = ref('')
const internalLabel = ref('')

const aggOptions = [
  { label: '求和', value: 'sum' }, { label: '计数', value: 'count' }, { label: '平均', value: 'avg' },
  { label: '最大', value: 'max' }, { label: '最小', value: 'min' }, { label: '不显示', value: 'none' } 
]

watch(() => props.visible, (val) => {
  if (val) {
    internalRule.value = props.currentRule || 'none'
    internalExpression.value = props.currentExpression || ''
    internalLabel.value = props.currentLabel || ''
    internalTab.value = props.currentExpression ? 'formula' : 'basic'
  }
})

const insertVariable = (label) => {
  internalExpression.value += `{${label}}`
}

const handleSave = () => {
  emit('save', {
    rule: internalRule.value,
    expression: internalExpression.value,
    label: internalLabel.value,
    tab: internalTab.value
  })
}
</script>

<style scoped>
.dialog-tip { margin-bottom: 12px; color: #606266; font-size: 13px; line-height: 1.5; }
.agg-radio-group { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.variable-tags { margin-top: 15px; }
.tag-label { font-size: 12px; color: #909399; margin-bottom: 8px; display: block; }
.tags-container { display: flex; flex-wrap: wrap; gap: 8px; }
.variable-tag { cursor: pointer; }
.variable-tag:hover { opacity: 0.8; }
</style>
