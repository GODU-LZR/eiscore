<template>
  <el-dialog
    v-model="visible"
    title="列配置管理"
    width="800px"
    destroy-on-close
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="column-manager">
      <div class="column-list">
        <div class="list-header">
          <span>现有列 ({{ localColumns.length }})</span>
          <el-button type="primary" link size="small" @click="addNewColumn">
            <el-icon><Plus /></el-icon> 新增
          </el-button>
        </div>
        <el-scrollbar height="400px">
          <div
            v-for="(col, index) in localColumns"
            :key="index"
            class="column-item"
            :class="{ active: currentColumnIndex === index }"
            @click="selectColumn(index)"
          >
            <span class="col-label">{{ col.label }}</span>
            <span class="col-prop">{{ col.prop }}</span>
            <el-icon class="delete-btn" @click.stop="removeColumn(index)"><Delete /></el-icon>
          </div>
        </el-scrollbar>
      </div>

      <div class="column-editor" v-if="currentColumn">
        <el-form label-position="top" size="small">
          <el-row :gutter="10">
            <el-col :span="12">
              <el-form-item label="列名 (Label)">
                <el-input v-model="currentColumn.label" placeholder="如: 性别" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="字段 (Prop)">
                <el-input v-model="currentColumn.prop" placeholder="如: gender" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="10">
            <el-col :span="12">
              <el-form-item label="列宽">
                <el-input-number v-model="currentColumn.width" :min="50" :step="10" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="数据类型">
                <el-select v-model="currentColumn.type" style="width:100%">
                  <el-option label="普通文本 (Text)" value="text" />
                  <el-option label="下拉选择 (Select)" value="select" />
                  <el-option label="状态徽标 (Status)" value="status" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <div v-if="currentColumn.type === 'select'" class="options-config">
            <div class="divider">下拉选项配置</div>
            <div class="options-list">
              <div v-for="(opt, idx) in (currentColumn.options || [])" :key="idx" class="option-row">
                <el-input v-model="opt.label" placeholder="显示名 (如: 男)" style="flex:1" />
                <span class="arrow">→</span>
                <el-input v-model="opt.value" placeholder="存储值 (如: male)" style="flex:1" />
                <el-color-picker v-model="opt.color" show-alpha size="small" />
                <el-button type="danger" link icon="Delete" @click="removeOption(idx)" />
              </div>
              <el-button class="add-opt-btn" type="dashed" size="small" @click="addOption">
                + 添加选项
              </el-button>
            </div>
          </div>

          <el-form-item label="其他设置" style="margin-top: 10px;">
            <el-checkbox v-model="currentColumn.sortable">允许排序</el-checkbox>
            <el-checkbox v-model="currentColumn.fixed" true-label="left" :false-label="false">冻结在左侧</el-checkbox>
          </el-form-item>
        </el-form>
      </div>
      <div v-else class="empty-state">
        请选择或新增一列进行编辑
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">应用配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: Boolean,
  columns: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'save'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const localColumns = ref([])
const currentColumnIndex = ref(-1)
const currentColumn = computed(() => {
  return currentColumnIndex.value > -1 ? localColumns.value[currentColumnIndex.value] : null
})

// 初始化数据
watch(() => props.modelValue, (val) => {
  if (val) {
    // 深拷贝，防止直接修改父组件数据
    localColumns.value = JSON.parse(JSON.stringify(props.columns))
    if (localColumns.value.length > 0) {
      currentColumnIndex.value = 0
    }
  }
})

const selectColumn = (index) => {
  currentColumnIndex.value = index
}

const addNewColumn = () => {
  localColumns.value.push({
    label: '新列',
    prop: `field_${Date.now()}`,
    type: 'text',
    width: 120,
    sortable: true,
    options: []
  })
  // 自动选中新列
  nextTick(() => {
    currentColumnIndex.value = localColumns.value.length - 1
  })
}

const removeColumn = (index) => {
  localColumns.value.splice(index, 1)
  if (currentColumnIndex.value >= localColumns.value.length) {
    currentColumnIndex.value = Math.max(0, localColumns.value.length - 1)
  }
}

// 选项管理
const addOption = () => {
  if (!currentColumn.value.options) {
    currentColumn.value.options = []
  }
  currentColumn.value.options.push({ label: '', value: '', color: '' })
}

const removeOption = (idx) => {
  currentColumn.value.options.splice(idx, 1)
}

const handleSave = () => {
  emit('save', localColumns.value)
  visible.value = false
  ElMessage.success('列配置已更新')
}
</script>

<style scoped lang="scss">
.column-manager {
  display: flex;
  height: 450px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.column-list {
  width: 240px;
  border-right: 1px solid #dcdfe6;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;

  .list-header {
    padding: 10px;
    border-bottom: 1px solid #ebeef5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    color: #606266;
  }

  .column-item {
    padding: 10px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s;
    &:hover { background-color: #ecf5ff; }
    &.active { background-color: #d9ecff; color: #409eff; }

    .col-label { font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-prop { font-size: 11px; color: #909399; margin-left: 8px; max-width: 80px; overflow: hidden; }
    .delete-btn { opacity: 0; margin-left: 4px; color: #f56c6c; }
    &:hover .delete-btn { opacity: 1; }
  }
}

.column-editor {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.options-config {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;

  .divider {
    font-size: 12px;
    font-weight: bold;
    color: #606266;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px dashed #dcdfe6;
  }

  .option-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    .arrow { color: #909399; font-size: 12px; }
  }

  .add-opt-btn {
    width: 100%;
    border-style: dashed;
  }
}

:global(#app.dark) .el-dialog {
  background-color: #0f172a;
  color: #f3f4f6;
}
:global(#app.dark) .el-dialog__title {
  color: #f3f4f6;
}
:global(#app.dark) .column-manager {
  border-color: #1f2937;
}
:global(#app.dark) .column-list {
  border-right-color: #1f2937;
  background-color: #0b0f14;
}
:global(#app.dark) .column-list .list-header {
  border-bottom-color: #1f2937;
  color: #f3f4f6;
}
:global(#app.dark) .column-item {
  color: #f3f4f6;
}
:global(#app.dark) .column-item.active {
  background-color: rgba(56, 139, 253, 0.2);
  color: #f9fafb;
}
:global(#app.dark) .column-item:hover {
  background-color: rgba(148, 163, 184, 0.15);
}
:global(#app.dark) .column-item .col-prop,
:global(#app.dark) .column-item .arrow {
  color: #e5e7eb;
}
:global(#app.dark) .column-editor {
  color: #f3f4f6;
}
:global(#app.dark) .options-config {
  background-color: #0b0f14;
  border: 1px solid #1f2937;
}
:global(#app.dark) .options-config .divider {
  color: #f3f4f6;
  border-bottom-color: #1f2937;
}
:global(#app.dark) :deep(.el-input__wrapper),
:global(#app.dark) :deep(.el-textarea__inner),
:global(#app.dark) :deep(.el-select__wrapper),
:global(#app.dark) :deep(.el-input-number) {
  background-color: #0b0f14;
  border-color: #1f2937;
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-input__inner) {
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-form-item__label) {
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-tabs__item.is-active) {
  color: #f3f4f6;
}
:global(#app.dark) :deep(.el-tabs__active-bar) {
  background-color: #f3f4f6;
}
</style>
