<template>
  <div class="batch-rule-manager">
    <el-card class="rule-list" shadow="never">
      <AppCenterGrid
        ref="gridRef"
        :app-data="appData"
        :app-id="''"
        create-mode="dialog"
        @create="openCreateDialog"
      />
    </el-card>

    <el-dialog
      v-model="createVisible"
      title="创建规则"
      width="760px"
      append-to-body
      destroy-on-close
    >
      <el-form :model="createForm" label-width="110px" class="rule-form">
        <el-form-item label="规则名称" required>
          <el-input v-model="createForm.rule_name" placeholder="例如：默认批次" />
        </el-form-item>

        <el-form-item label="重置策略" required>
          <el-select v-model="createForm.reset_strategy" placeholder="请选择">
            <el-option label="每日" value="每日" />
            <el-option label="每月" value="每月" />
            <el-option label="连续" value="连续" />
          </el-select>
        </el-form-item>

        <el-form-item label="状态" required>
          <el-select v-model="createForm.status" placeholder="请选择">
            <el-option label="启用" value="启用" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>

        <el-form-item label="规则模板" required>
          <el-input
            ref="templateInputRef"
            v-model="createForm.rule_template"
            placeholder="{物料编码}-{日期:YYYYMMDD}-{序号:3}"
          />
          <div class="placeholder-bar">
            <span class="placeholder-label">占位符：</span>
            <el-button text size="small" @click="insertToken('{物料编码}')">物料编码</el-button>
            <el-button text size="small" @click="insertToken('{日期:YYYYMMDD}')">日期</el-button>
            <el-button text size="small" @click="insertSeq">序号</el-button>
            <el-button text size="small" @click="insertToken('{物料分类}')">物料分类</el-button>
            <el-button text size="small" @click="insertToken('{仓库}')">仓库</el-button>
          </div>
        </el-form-item>

        <el-form-item label="示例预览">
          <el-input :model-value="examplePreview" readonly />
        </el-form-item>

        <el-form-item label="说明">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="可填写规则用途或说明" />
        </el-form-item>

        <div class="rule-hints">
          <el-tag size="small" type="info" effect="plain">手动输入批次号将优先于规则生成</el-tag>
          <el-tag size="small" type="success" effect="plain">启用规则会在入库时出现在下拉列表</el-tag>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppCenterGrid from '@/components/AppCenterGrid.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const gridRef = ref(null)
const createVisible = ref(false)
const saving = ref(false)
const templateInputRef = ref(null)
const userStore = useUserStore()
const currentUser = computed(() => userStore.userInfo?.username || 'Admin')
const currentDeptId = computed(() => userStore.userInfo?.dept_id || userStore.userInfo?.deptId || '')
const createForm = ref({
  rule_name: '',
  rule_template: '',
  reset_strategy: '每日',
  status: '启用',
  description: ''
})
const appData = computed(() => ({
  name: '批次号规则配置',
  desc: '配置物料批次号生成规则',
  config: {
    table: 'scm.batch_no_rules',
    viewId: 'batch_rules',
    hideActions: true,
    configKey: 'batch_rules_cols_v2',
    skipColumnConfig: true,
    columns: [
      { label: '规则名称', prop: 'rule_name', type: 'text', isStatic: true, editable: true },
      { label: '规则模板', prop: 'rule_template', type: 'text', isStatic: true, editable: true },
      {
        label: '序列重置策略',
        prop: 'reset_strategy',
        type: 'select',
        options: [
          { label: '每日', value: '每日' },
          { label: '每月', value: '每月' },
          { label: '连续', value: '连续' }
        ],
        isStatic: true,
        editable: true
      },
      { label: '示例预览', prop: 'example_output', type: 'text', isStatic: true, editable: false },
      {
        label: '状态',
        prop: 'status',
        type: 'select',
        options: [
          { label: '启用', value: '启用' },
          { label: '停用', value: '停用' }
        ],
        isStatic: true,
        editable: true
      },
      { label: '说明', prop: 'description', type: 'text', isStatic: true, editable: true },
      { label: '创建人', prop: 'created_by', type: 'text', isStatic: true, editable: false },
      { label: '创建时间', prop: 'created_at', type: 'text', isStatic: true, editable: false }
    ],
    summary: { label: '合计', rules: {}, expressions: {} },
    staticHidden: [],
    configKey: 'batch_rules_cols',
    enableRealtime: true
  }
}))

const examplePreview = computed(() => {
  const template = createForm.value.rule_template || ''
  if (!template) return ''
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  let result = template
    .replaceAll('{物料编码}', 'MAT001')
    .replaceAll('{物料分类}', 'CAT01')
    .replaceAll('{仓库}', 'WH001')
    .replaceAll('{日期:YYYYMMDD}', `${yyyy}${mm}${dd}`)
    .replaceAll('{YYYY}', yyyy)
    .replaceAll('{MM}', mm)
    .replaceAll('{DD}', dd)

  const seqMatch = result.match(/\{序号:(\d+)\}/)
  if (seqMatch) {
    const len = Number(seqMatch[1]) || 3
    const seq = String(1).padStart(len, '0')
    result = result.replace(seqMatch[0], seq)
  }
  return result
})

const insertToken = (token) => {
  const inputEl = templateInputRef.value?.input
  if (!inputEl) {
    createForm.value.rule_template = `${createForm.value.rule_template || ''}${token}`
    return
  }
  const start = inputEl.selectionStart ?? 0
  const end = inputEl.selectionEnd ?? 0
  const current = createForm.value.rule_template || ''
  createForm.value.rule_template = `${current.slice(0, start)}${token}${current.slice(end)}`
  requestAnimationFrame(() => {
    inputEl.focus()
    const nextPos = start + token.length
    inputEl.setSelectionRange(nextPos, nextPos)
  })
}

const insertSeq = () => {
  insertToken('{序号:3}')
}

const openCreateDialog = () => {
  createVisible.value = true
}

const submitCreate = async () => {
  const ruleName = (createForm.value.rule_name || '').trim()
  const ruleTemplate = (createForm.value.rule_template || '').trim()
  if (!ruleName || !ruleTemplate) {
    ElMessage.warning('请填写规则名称和规则模板')
    return
  }
  saving.value = true
  try {
    const encodedName = encodeURIComponent(ruleName)
    const existing = await request({
      url: `/batch_no_rules?rule_name=eq.${encodedName}&select=id`,
      method: 'get',
      headers: { 'Accept-Profile': 'scm' }
    })
    if (Array.isArray(existing) && existing.length > 0) {
      ElMessage.warning('规则名称已存在，请更换名称')
      return
    }
    await request({
      url: '/batch_no_rules',
      method: 'post',
      headers: { 'Content-Profile': 'scm', 'Accept-Profile': 'scm', 'Prefer': 'return=representation' },
      data: {
        rule_name: ruleName,
        rule_template: ruleTemplate,
        reset_strategy: createForm.value.reset_strategy,
        applicable_categories: [],
        status: createForm.value.status,
        example_output: examplePreview.value,
        description: createForm.value.description,
        created_by: currentUser.value,
        dept_id: currentDeptId.value || null
      }
    })
    ElMessage.success('规则已创建')
    createVisible.value = false
    createForm.value = {
      rule_name: '',
      rule_template: '',
      reset_strategy: '每日',
      status: '启用',
      description: ''
    }
    gridRef.value?.reload?.()
  } catch (e) {
    if (e?.response?.status === 409) {
      ElMessage.error('规则名称已存在，请更换名称')
      return
    }
    const detail = e?.response?.data?.message || e?.response?.data?.details || e?.message
    ElMessage.error(detail || '创建失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.rule-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.placeholder-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.placeholder-label {
  font-size: 12px;
  color: #909399;
}

.rule-hints {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
</style>

<style scoped>
.batch-rule-manager {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.rule-list {
  border-radius: 12px;
  background: #ffffff;
  flex: 1;
  min-height: 320px;
  display: flex;
  flex-direction: column;
}

.rule-list :deep(.el-card__body) {
  flex: 1;
  display: flex;
  padding: 0;
}

.rule-list :deep(.app-container) {
  flex: 1;
  min-height: 360px;
}

.rule-list :deep(.grid-card) {
  flex: 1;
  min-height: 360px;
}

.rule-list :deep(.eis-grid-wrapper) {
  height: 100%;
  min-height: 360px;
}

.rule-list :deep(.eis-grid-container) {
  min-height: 560px;
  height: 680px;
}

.rule-list :deep(.ag-root-wrapper),
.rule-list :deep(.ag-root-wrapper-body),
.rule-list :deep(.ag-root) {
  min-height: 560px;
}
</style>
