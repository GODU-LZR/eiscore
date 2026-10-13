<template>
  <div class="acl-view">
    <div class="header">
      <div class="title">角色与权限管理</div>
      <div class="role-label">当前设置角色：</div>
      <el-select v-model="currentRoleId" placeholder="选择角色" style="width: 240px" @change="refreshRoleScoped">
        <el-option v-for="r in roles" :key="r.id" :label="roleLabel(r)" :value="r.id" />
      </el-select>
      <div class="header-actions">
        <el-button type="success" plain title="按内置角色模板补齐权限" @click="applyRoleTemplates">应用权限默认模板</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane label="角色列表" name="roles">
        <div class="grid-wrap">
          <eis-data-grid
            ref="rolesGridRef"
            export-name="角色列表"
            view-id="hr_acl_roles"
            api-url="/v_roles_manage?order=sort.asc"
            write-url="/v_roles_manage"
            write-mode="patch"
            acl-module="hr_acl"
            :include-properties="false"
            :static-columns="roleColumnsDisplay"
            :extra-columns="[]"
            :row-filter="aclRowFilter"
            :summary="roleSummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :show-status-col="false"
            :auto-size-columns="false"
            :enable-column-lock="false"
            default-order=""
            summary-scope="server"
            @create="handleCreate('roles')"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handleRoleChanged"
            @data-loaded="handleGridDataLoaded('roles', $event)"
            @data-load-error="handleGridDataLoadError('roles')"
            @delete-complete="handleRoleDeleted"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="模块权限" name="perm-module">
        <div class="grid-wrap">
          <eis-data-grid
            ref="permsModuleGridRef"
            export-name="模块权限"
            view-id="hr_acl_permissions_module"
            :api-url="permModuleApiUrl"
            write-url="/v_role_permissions_matrix"
            write-mode="patch"
            acl-module="hr_acl"
            :patch-required-fields="['role_id','permission_id']"
            :include-properties="false"
            :static-columns="permColumnsModule"
            :extra-columns="[]"
            :row-filter="aclRowFilter"
            :summary="permissionSummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :show-status-col="false"
            :auto-size-columns="false"
            :enable-column-lock="false"
            default-order=""
            :can-create="false"
            summary-scope="server"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handlePermissionChanged"
            @data-loaded="handleGridDataLoaded('perm-module', $event)"
            @data-load-error="handleGridDataLoadError('perm-module')"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="应用权限" name="perm-app">
        <div class="table-toolbar">
          <span class="filter-label">筛选模块：</span>
          <el-select v-model="permModuleGroup" placeholder="全部模块" style="width: 180px" clearable>
            <el-option v-for="m in moduleFilters" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
          <span class="filter-label">筛选子应用：</span>
          <el-select v-model="permApp" placeholder="选择子应用" style="width: 220px" clearable>
            <el-option v-for="m in permAppOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </div>
        <div class="grid-wrap">
          <eis-data-grid
            ref="permsAppGridRef"
            export-name="应用权限"
            view-id="hr_acl_permissions_app"
            :api-url="permAppApiUrl"
            write-url="/v_role_permissions_matrix"
            write-mode="patch"
            acl-module="hr_acl"
            :patch-required-fields="['role_id','permission_id']"
            :include-properties="false"
            :static-columns="permColumnsApp"
            :extra-columns="[]"
            :row-filter="aclRowFilter"
            :summary="permissionSummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :show-status-col="false"
            :auto-size-columns="false"
            :enable-column-lock="false"
            default-order=""
            :can-create="false"
            summary-scope="server"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handlePermissionChanged"
            @data-loaded="handleGridDataLoaded('perm-app', $event)"
            @data-load-error="handleGridDataLoadError('perm-app')"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="应用操作权限" name="perm-op">
        <div class="table-toolbar">
          <span class="filter-label">筛选模块：</span>
          <el-select v-model="permModuleGroup" placeholder="全部模块" style="width: 180px" clearable>
            <el-option v-for="m in moduleFilters" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
          <span class="filter-label">筛选子应用：</span>
          <el-select v-model="permApp" placeholder="选择子应用" style="width: 220px" clearable>
            <el-option v-for="m in permAppOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </div>
        <div class="grid-wrap">
          <eis-data-grid
            ref="permsOpGridRef"
            export-name="应用操作权限"
            view-id="hr_acl_permissions_op"
            :api-url="permOpApiUrl"
            write-url="/v_role_permissions_matrix"
            write-mode="patch"
            acl-module="hr_acl"
            :patch-required-fields="['role_id','permission_id']"
            :include-properties="false"
            :static-columns="permColumnsOp"
            :extra-columns="[]"
            :row-filter="aclRowFilter"
            :summary="permissionSummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :show-status-col="false"
            :auto-size-columns="false"
            :enable-column-lock="false"
            default-order=""
            :can-create="false"
            summary-scope="server"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handlePermissionChanged"
            @data-loaded="handleGridDataLoaded('perm-op', $event)"
            @data-load-error="handleGridDataLoadError('perm-op')"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="应用表格列权限" name="field">
        <div class="table-toolbar">
          <span class="filter-label">筛选模块：</span>
          <el-select v-model="fieldModuleGroup" placeholder="全部模块" style="width: 180px" clearable>
            <el-option v-for="m in moduleFilters" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
          <span class="filter-label">筛选子应用：</span>
          <el-select v-model="fieldModule" placeholder="选择子应用" style="width: 220px" clearable>
            <el-option v-for="m in fieldModuleOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </div>
        <div class="grid-wrap">
          <eis-data-grid
            ref="fieldGridRef"
            export-name="应用表格列权限"
            view-id="hr_acl_fields"
            :api-url="fieldApiUrl"
            write-url="/sys_field_acl"
            write-mode="patch"
            acl-module="hr_acl"
            :patch-required-fields="['role_id','module','field_code']"
            :include-properties="false"
            :static-columns="fieldColumnsDisplay"
            :extra-columns="[]"
            :row-filter="aclRowFilter"
            :summary="fieldSummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :show-status-col="false"
            :auto-size-columns="false"
            :enable-column-lock="false"
            default-order=""
            summary-scope="server"
            @create="handleCreate('fields')"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handleFieldAclChanged"
            @data-loaded="handleGridDataLoaded('field', $event)"
            @data-load-error="handleGridDataLoadError('field')"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="部门数据查看范围" name="scope">
        <div class="table-toolbar">
          <span class="filter-label">筛选模块：</span>
          <el-select v-model="scopeModuleGroup" placeholder="全部模块" style="width: 180px" clearable>
            <el-option v-for="m in moduleFilters" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
          <span class="filter-label">筛选子应用：</span>
          <el-select v-model="scopeApp" placeholder="选择子应用" style="width: 220px" clearable>
            <el-option v-for="m in scopeAppOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </div>
        <div class="grid-wrap">
          <eis-data-grid
            ref="scopeGridRef"
            export-name="部门数据查看范围"
            view-id="hr_acl_scopes"
            :api-url="scopeApiUrl"
            write-url="/v_role_data_scopes_matrix"
            write-mode="patch"
            acl-module="hr_acl"
            :patch-required-fields="['role_id','module']"
            :include-properties="false"
            :static-columns="scopeColumnsDisplay"
            :extra-columns="[]"
            :row-filter="aclRowFilter"
            :summary="scopeSummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :show-status-col="false"
            :auto-size-columns="false"
            :enable-column-lock="false"
            default-order=""
            summary-scope="server"
            @create="handleCreate('scopes')"
            @config-columns="handleConfigColumns"
            @data-loaded="handleGridDataLoaded('scope', $event)"
            @data-load-error="handleGridDataLoadError('scope')"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, computed, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import request from '@/utils/request'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import { ElMessage } from 'element-plus'
import { formatPermissionName, parsePermissionCode, MODULE_LABELS, SIDEBAR_MODULE_KEYS, SIDEBAR_MODULE_LABELS, APP_LABELS, OP_ACTION_LABELS } from '@/utils/permission-spec'
import { FIELD_LABELS } from '@/utils/field-labels'
import { HR_APPS } from '@/utils/hr-apps'
import { buildPermissionPayload as buildStaticPermissionPayload, STATIC_APP_CATALOG, AUXILIARY_OPERATION_CATALOG } from '@/utils/permission-catalog'
import { pushAiContext } from '@/utils/ai-context'
import { pushStandardGridAgentContext } from '@shared/eis-grid-standard-agent-context'
import { buildGridLoadState } from '@shared/eis-grid-agent-context'
import { getRoleLabel } from '@shared/eis-role-labels.mjs'
import { getRealtimeClient } from '@/utils/realtime'

// The ACL application is intentionally independent from the business qiankun
// bundles. Keep the canonical grid field list here so an administrator can
// configure a module before its child app has ever been opened (the child app
// normally calls ensure_field_acl on mount).
const BUSINESS_FIELD_CATALOG = Object.freeze({
  mms_ledger: [
    ['batch_no', '物料编码'], ['name', '物料名称'], ['category', '物料分类编码'],
    ['spec', '规格'], ['unit', '单位'], ['measure_unit', '计量单位'],
    ['conversion_ratio', '换算比例'], ['conversion', '换算关系'],
    ['finance_attribute', '财务属性'], ['created_by', '创建人']
  ],
  sales_customer: [
    ['customer_no', '客户编码'], ['name', '客户名称'], ['level', '客户等级'],
    ['contact_name', '联系人'], ['contact_phone', '联系电话'], ['region', '所属区域'],
    ['owner_name', '销售负责人'], ['customer_status', '客户状态'], ['credit_limit', '信用额度'],
    ['receivable_balance', '应收余额'], ['last_follow_up_at', '最近跟进']
  ],
  sales_follow_up: [
    ['follow_no', '跟进编号'], ['customer_name', '客户名称'], ['contact_name', '联系人'],
    ['follow_date', '跟进日期'], ['follow_type', '跟进方式'], ['follow_result', '跟进结果'],
    ['next_follow_at', '下次跟进'], ['owner_name', '负责人'], ['follow_content', '跟进内容']
  ],
  sales_opportunity: [
    ['opportunity_no', '商机编号'], ['opportunity_name', '商机名称'], ['customer_name', '客户名称'],
    ['expected_amount', '预计金额'], ['stage', '阶段'], ['probability', '成交概率'],
    ['expected_close_date', '预计成交日期'], ['owner_name', '负责人'], ['next_action', '下一步行动'], ['remark', '备注']
  ],
  sales_order: [
    ['order_no', '订单号'], ['customer_name', '客户名称'], ['product_material_code', 'BOM物料'],
    ['product_name', '产品名称'], ['quantity', '数量'], ['unit', '单位'], ['unit_price', '单价'],
    ['total_amount', '订单金额'], ['order_date', '下单日期'], ['delivery_date', '交付日期'],
    ['order_status', '订单状态'], ['owner_name', '负责人']
  ],
  sales_payment: [
    ['payment_no', '回款单号'], ['order_no', '订单号'], ['customer_name', '客户名称'], ['amount', '回款金额'],
    ['payment_date', '回款日期'], ['payment_method', '回款方式'], ['verify_status', '核销状态'], ['handler_name', '经办人']
  ],
  purchase_supplier: [
    ['supplier_no', '供应商编码'], ['name', '供应商名称'], ['level', '等级'], ['contact_name', '联系人'],
    ['contact_phone', '联系电话'], ['category', '主营品类'], ['payment_terms', '付款条件'],
    ['lead_time_days', '交期天数'], ['buyer_name', '采购负责人'], ['supplier_status', '状态'], ['last_review_at', '最近评审']
  ],
  purchase_demand: [
    ['demand_no', '需求单号'], ['material_no', '物料编码'], ['material_name', '物料名称'], ['quantity', '需求数量'],
    ['unit', '单位'], ['required_date', '需求日期'], ['source_dept', '来源部门'], ['requester_name', '申请人'],
    ['bom_source', 'BOM来源'], ['source_product_codes', '来源成品'], ['source_order_nos', '来源销售订单'],
    ['preferred_supplier', '建议供应商'], ['demand_status', '需求状态'], ['remark', '备注']
  ],
  purchase_order: [
    ['order_no', '订单号'], ['source_demand_no', '来源需求单'], ['supplier_name', '供应商名称'], ['material_name', '物料名称'],
    ['quantity', '数量'], ['unit', '单位'], ['unit_price', '单价'], ['total_amount', '订单金额'], ['order_date', '下单日期'],
    ['expected_arrival_date', '预计到货日期'], ['buyer_name', '采购负责人'], ['arrived_quantity', '已到货数量'],
    ['pending_quantity', '待到货数量'], ['arrival_progress', '到货进度'], ['order_status', '订单状态'],
    ['delivery_risk', '交期风险'], ['tax_included_amount', '订单含税金额']
  ],
  purchase_arrival: [
    ['arrival_no', '到货单号'], ['order_no', '订单号'], ['supplier_name', '供应商名称'], ['material_name', '物料名称'],
    ['arrival_quantity', '到货数量'], ['accepted_quantity', '合格数量'], ['unit', '单位'], ['arrival_date', '到货日期'],
    ['iqc_status', '来料检验状态'], ['inbound_no', '入库单号'], ['arrival_status', '到货状态'], ['exception_note', '异常说明']
  ],
  mms_bom: [
    ['bom_no', '配方编号'], ['bom_name', '配方名称'], ['parent_material_code', '生产产品编码'], ['parent_material_name', '生产产品名称'],
    ['version', '版本'], ['base_qty', '一次产出'], ['unit', '单位'], ['bom_type', '配方类型'], ['status', '状态'],
    ['item_count', '用料项'], ['effective_from', '生效日期'], ['remark', '备注']
  ],
  production_plan: [
    ['product_material_code', '成品编码'], ['product_material_name', '成品名称'], ['sales_qty', '销售数量'],
    ['finished_available_qty', '成品库存'], ['planned_qty', '建议生产'], ['unit', '单位'], ['earliest_delivery_date', '最早交期'],
    ['bom_no', 'BOM编号'], ['bom_version', 'BOM版本'], ['work_order_count', '工单数'], ['open_work_order_count', '未关闭工单'],
    ['plan_status', '计划状态'], ['source_order_nos', '来源订单']
  ],
  production_work_order: [
    ['work_order_no', '工单号'], ['product_material_code', '成品编码'], ['product_material_name', '成品名称'],
    ['planned_qty', '计划数量'], ['unit', '单位'], ['planned_start_date', '计划开始'], ['planned_finish_date', '计划完成'],
    ['work_order_status', '工单状态'], ['priority', '优先级'], ['bom_no', 'BOM编号'], ['bom_version', 'BOM版本'],
    ['item_count', '用料项'], ['shortage_item_count', '缺料项'], ['source_order_nos', '来源订单'], ['remark', '备注'],
    ['line_no', '行号'], ['component_material_code', '子件编码'], ['component_material_name', '子件名称'],
    ['required_qty', '需求数量'], ['issued_qty', '已领数量'], ['available_qty', '可用库存'], ['shortage_qty', '缺料数量'], ['issue_status', '领料状态']
  ],
  quality_inspection: [
    ['doc_no', '检验单号'], ['inspection_type', '检验类型'], ['source_doc_no', '来源单号'], ['item_code', '物料编码'],
    ['item_name', '物料/产品'], ['source_name', '供应商/产线'], ['batch_no', '批次号'], ['sample_qty', '抽检数'], ['defect_qty', '不良数'],
    ['result', '检验结果'], ['inspector', '检验员'], ['inspection_date', '检验日期'], ['remark', '备注'],
    ['standard', '检验标准'], ['disposition', '处置建议'], ['defect_rate', '不良率']
  ],
  quality_ncr: [
    ['doc_no', '异常单号'], ['source_type', '异常来源'], ['source_doc_no', '来源单号'], ['issue_desc', '问题描述'], ['severity', '严重度'],
    ['owner_dept', '责任部门'], ['owner_name', '责任人'], ['deadline', '整改期限'], ['ncr_status', '状态'],
    ['corrective_action', '纠正措施'], ['verification_result', '验证结论'], ['root_cause_type', '根因分类']
  ],
  quality_action: [
    ['action_no', '任务单号'], ['ncr_doc_no', '异常单号'], ['action_type', '任务类型'], ['task_desc', '任务内容'],
    ['owner_dept', '责任部门'], ['owner_name', '责任人'], ['due_date', '到期日期'], ['action_status', '任务状态'],
    ['verify_owner', '验证人'], ['verify_date', '验证日期'], ['verify_result', '验证结果'], ['evidence', '完成证据']
  ],
  quality_audit: [
    ['audit_no', '审核单号'], ['audit_type', '审核类型'], ['audit_scope', '审核范围'], ['plan_date', '计划日期'], ['auditor', '审核员'],
    ['finding_count', '发现项数'], ['audit_status', '审核状态'], ['conclusion', '审核结论'], ['audit_location', '审核地点']
  ],
  quality_standard: [
    ['standard_no', '标准编号'], ['standard_name', '标准名称'], ['item_category', '物料类别'], ['version', '版本'],
    ['effective_date', '生效日期'], ['owner_name', '负责人'], ['standard_status', '标准状态'], ['key_metrics', '关键指标'], ['attachments', '附件']
  ],
  equipment_asset: [
    ['asset_no', '设备编号'], ['asset_name', '设备名称'], ['asset_type', '设备类型'], ['location_name', '产线/区域'], ['asset_level', '重要等级'],
    ['run_status', '运行状态'], ['owner_dept', '责任部门'], ['owner_name', '责任人'], ['commission_date', '启用日期'], ['last_maint_date', '上次保养'],
    ['next_maint_date', '下次保养'], ['health_score', '健康评分'], ['remark', '备注'], ['manufacturer', '设备厂家'], ['asset_value', '资产原值'], ['geo_location', '设备位置']
  ],
  equipment_check: [
    ['check_no', '点检单号'], ['asset_no', '设备编号'], ['asset_name', '设备名称'], ['check_type', '点检类型'], ['check_item_count', '点检项数'],
    ['abnormal_count', '异常项数'], ['check_result', '点检结果'], ['checker', '点检人'], ['check_date', '点检日期'], ['remark', '备注'],
    ['temperature', '温度'], ['vibration', '振动'], ['check_photos', '点检照片']
  ],
  equipment_issue: [
    ['issue_no', '异常单号'], ['asset_no', '设备编号'], ['asset_name', '设备名称'], ['source_type', '异常来源'], ['issue_desc', '异常描述'],
    ['issue_level', '紧急程度'], ['owner_dept', '责任部门'], ['owner_name', '责任人'], ['occurred_date', '发生日期'], ['deadline', '处理期限'],
    ['issue_status', '状态'], ['repair_action', '处理措施'], ['fault_type', '故障分类']
  ],
  equipment_work_order: [
    ['work_order_no', '工单号'], ['issue_no', '异常单号'], ['asset_no', '设备编号'], ['asset_name', '设备名称'], ['work_type', '工单类型'],
    ['task_desc', '任务描述'], ['maintainer', '维修人'], ['plan_date', '计划日期'], ['finish_date', '完成日期'], ['downtime_hours', '停机时长'],
    ['work_status', '工单状态'], ['acceptance_result', '验收结果'], ['spare_parts', '更换备件'], ['repair_photos', '维修照片']
  ],
  equipment_plan: [
    ['plan_no', '计划编号'], ['plan_name', '计划名称'], ['asset_scope', '设备范围'], ['plan_type', '计划类型'], ['cycle_name', '周期'],
    ['start_date', '开始日期'], ['next_execute_date', '下次执行日期'], ['owner_name', '负责人'], ['plan_status', '计划状态'],
    ['completion_rate', '完成率'], ['notify_method', '提醒方式']
  ],
  equipment_standard: [
    ['standard_no', '标准编号'], ['standard_name', '标准名称'], ['asset_type', '设备类型'], ['version', '版本'], ['effective_date', '生效日期'],
    ['owner_name', '负责人'], ['standard_status', '标准状态'], ['key_items', '关键项目'], ['attachments', '标准附件']
  ]
})

const businessFieldColumns = (moduleKey) => (BUSINESS_FIELD_CATALOG[moduleKey] || [])
  .map(([prop, label]) => ({ prop, label }))

const roles = ref([])
const selectedRoleStatus = computed(() => {
  const role = roles.value.find((item) => String(item?.id) === String(currentRoleId.value))
  return role?.status ? String(role.status).toLowerCase() : ''
})
// Field ACL rows are read directly from sys_field_acl and therefore do not
// carry role_status like the matrix views. Annotate them before the shared grid
// applies its ACL row-lock rule.
const aclRowFilter = (row) => {
  if (row && !row.role_status && selectedRoleStatus.value) row.role_status = selectedRoleStatus.value
  return true
}
const baseModules = Array.from(new Set([
  'hr_employee', 'hr_org', 'hr_attendance', 'hr_change', 'hr_acl', 'hr_user', 'hr_payroll',
  ...(Array.isArray(STATIC_APP_CATALOG) ? STATIC_APP_CATALOG.map(app => app.key) : [])
]))
const modules = ref([...baseModules])
const appCenterApps = ref([])
// Keep data-scope department choices on the same public.departments source
// used by the HR organization and user-management views.
const departments = ref([])
let departmentsRealtimeUnsub = null
let departmentsReloadTimer = null

const normalizeAppId = (appId) => {
  if (!appId) return ''
  return String(appId).replace(/-/g, '')
}

const buildAppModuleKey = (app) => {
  const raw = normalizeAppId(app?.id)
  if (!raw) return ''
  return `app_${raw}`
}

const resolveAppModuleKey = (app) => {
  let config = app?.config || {}
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config)
    } catch {
      config = {}
    }
  }
  return String(config?.aclModule || app?.acl_module || buildAppModuleKey(app)).trim()
}

const isAclVisibleApp = (app) => String(app?.status || '').toLowerCase() !== 'archived'

const appCenterModuleMap = computed(() => {
  const map = {}
  appCenterApps.value.forEach((app) => {
    if (!isAclVisibleApp(app)) return
    const key = resolveAppModuleKey(app)
    if (key) map[key] = app
  })
  return map
})

const isDynamicAclModule = (moduleKey) => Boolean(moduleKey && appCenterModuleMap.value[moduleKey])

const currentRoleId = ref('')
const fieldModule = ref(modules.value[0] || '')
const fieldModuleGroup = ref('')
const permModuleGroup = ref('')
const permApp = ref('')
const scopeModuleGroup = ref('')
const scopeApp = ref('')
const activeTab = ref('roles')
const rolesGridRef = ref(null)
const permsModuleGridRef = ref(null)
const permsAppGridRef = ref(null)
const permsOpGridRef = ref(null)
const scopeGridRef = ref(null)
const fieldGridRef = ref(null)
const lastGridLoadStateMap = ref({})
const lastSearchTextMap = ref({})

const roleSummary = { label: '合计', rules: { name: 'count' }, expressions: {} }
const permissionSummary = { label: '合计', rules: { name: 'count' }, expressions: {} }
const fieldSummary = { label: '合计', rules: { module: 'count' }, expressions: {} }
const scopeSummary = { label: '合计', rules: { module: 'count' }, expressions: {} }

const roleDescMap = {
  super_admin: '拥有全部权限',
  hr_admin: '人事模块全权限',
  hr_clerk: '人事模块编辑权限',
  dept_manager: '部门管理权限',
  employee: '普通员工权限',
  hr_viewer: '仅查看权限'
}

const moduleLabel = (m) => {
  if (SIDEBAR_MODULE_LABELS[m]) return SIDEBAR_MODULE_LABELS[m]
  const app = appCenterModuleMap.value[m]
  if (app?.name) return app.name
  if (m?.startsWith('app_')) {
    return app?.name || '未命名子应用'
  }
  const map = {
    hr_employee: '人事花名册',
    hr_org: '部门架构',
    hr_attendance: '考勤管理',
    hr_change: '调岗记录',
    hr_acl: '权限管理',
    hr_user: '用户管理',
    mms_ledger: '物料台账'
  }
  const auxiliary = AUXILIARY_OPERATION_CATALOG.find(item => item.key === m)
  if (auxiliary?.name) return auxiliary.name
  return map[m] || APP_LABELS[m] || '未命名模块'
}

const getAppLabelByKey = (key) => {
  if (!key) return ''
  const dynamicApp = appCenterModuleMap.value[key]
  if (dynamicApp?.name) return dynamicApp.name
  if (key.startsWith('app_')) {
    return '未命名子应用'
  }
  const auxiliary = AUXILIARY_OPERATION_CATALOG.find(item => item.key === key)
  if (auxiliary?.name) return auxiliary.name
  return APP_LABELS[key] || '未命名子应用'
}

const permissionModuleLabel = (key) => {
  const value = String(key || '')
  if (value.startsWith('hr_')) return MODULE_LABELS.hr
  if (value.startsWith('mms_')) return MODULE_LABELS.mms
  if (value.startsWith('sales_')) return MODULE_LABELS.sales
  if (value.startsWith('purchase_')) return MODULE_LABELS.purchase
  if (value.startsWith('production_')) return MODULE_LABELS.production
  if (value.startsWith('quality_')) return MODULE_LABELS.quality
  if (value.startsWith('equipment_')) return MODULE_LABELS.equipment
  if (value.startsWith('app_') || appCenterModuleMap.value[value]) return MODULE_LABELS.app
  const auxiliary = AUXILIARY_OPERATION_CATALOG.find(item => item.key === value)
  return auxiliary?.name || MODULE_LABELS[value] || '未命名模块'
}

// Data-scope rows contain application-level module keys (for example
// `sales_order`), while the grid presents their top-level sidebar group.
// Keep this mapping total so a newly added module never renders as a blank
// cell in the ACL table.
const scopeModuleGroupLabel = (key) => {
  const value = String(key || '').trim()
  if (value.startsWith('hr_')) return SIDEBAR_MODULE_LABELS.hr || '人事管理'
  if (value.startsWith('mms_')) return SIDEBAR_MODULE_LABELS.mms || '仓储管理'
  if (value.startsWith('sales_')) return SIDEBAR_MODULE_LABELS.sales || '销售管理'
  if (value.startsWith('purchase_')) return SIDEBAR_MODULE_LABELS.purchase || '采购管理'
  if (value.startsWith('production_')) return SIDEBAR_MODULE_LABELS.production || '生产管理'
  if (value.startsWith('quality_')) return SIDEBAR_MODULE_LABELS.quality || '质量管理'
  if (value.startsWith('equipment_')) return SIDEBAR_MODULE_LABELS.equipment || '设备管理'
  if (value.startsWith('app_') || appCenterModuleMap.value[value]) return SIDEBAR_MODULE_LABELS.app || '应用中心'
  if (SIDEBAR_MODULE_LABELS[value]) return SIDEBAR_MODULE_LABELS[value]
  if (MODULE_LABELS[value]) return MODULE_LABELS[value]
  return '其他模块'
}

const actionLabel = (action) => {
  const value = String(action || '')
  if (value.startsWith('status_transition.')) return '状态变更'
  const map = {
    display: '显示',
    enter: '进入',
    view: '查看',
    create: '新增',
    edit: '编辑',
    delete: '删除',
    export: '导出',
    config: '配置',
    import: '导入',
    workflow_start: '流程发起',
    workflow_transition: '流程流转',
    workflow_complete: '流程完结',
    status_transition: '状态变更',
    ...OP_ACTION_LABELS
  }
  return map[value] || '其他动作'
}

const statusLabel = (status) => {
  const map = { created: '创建', draft: '创建', active: '生效', locked: '锁定', disabled: '停用', retired: '停用' }
  const normalized = String(status || '').toLowerCase()
  return map[normalized] || (status === null || status === undefined || status === '' ? '未设置' : status)
}

const formatAclDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

const aclDateColumn = (prop, label, sourceProp) => ({
  prop,
  label,
  width: 170,
  editable: false,
  valueGetter: (params) => params.data?.[sourceProp] || params.data?.[prop] || '',
  formatter: (params) => formatAclDate(params.value)
})

const permissionActionOptions = [
  { label: '显示', value: 'display' },
  { label: '进入', value: 'enter' },
  { label: '查看', value: 'view' },
  { label: '新增', value: 'create' },
  { label: '编辑', value: 'edit' },
  { label: '删除', value: 'delete' },
  { label: '导入', value: 'import' },
  { label: '导出', value: 'export' },
  { label: '配置', value: 'config' },
  { label: '保存布局', value: 'save_layout' },
  { label: '成员管理', value: 'member_manage' },
  { label: '班次管理', value: 'shift_manage' },
  { label: '班次新增', value: 'shift_create' },
  { label: '流程发起', value: 'workflow_start' },
  { label: '流程流转', value: 'workflow_transition' },
  { label: '流程完结', value: 'workflow_complete' },
  { label: '状态变更', value: 'status_transition' },
  { label: '入库', value: 'stock_in' },
  { label: '出库', value: 'stock_out' },
  { label: '审核', value: 'review' },
  { label: '暂停', value: 'pause' },
  { label: '恢复', value: 'resume' },
  { label: '生成订单', value: 'create_order' },
  { label: '提交', value: 'submit' },
  { label: '关闭', value: 'close' },
  { label: '重新打开', value: 'reopen' },
  { label: '登记到货', value: 'register_arrival' },
  { label: '确认', value: 'confirm' },
  { label: '取消', value: 'cancel' },
  { label: '确认入库', value: 'confirm_inbound' },
  { label: '标记异常', value: 'mark_exception' },
  { label: '反向处理', value: 'reverse' },
  { label: '审计', value: 'audit' }
]

const buildModulePermissionPayload = () => SIDEBAR_MODULE_KEYS.map((key) => ({
  code: `module:${key}`,
  name: `模块-${SIDEBAR_MODULE_LABELS[key] || MODULE_LABELS[key] || key}`,
  module: '模块',
  action: '显示',
  roles: ['super_admin']
}))

const aclStatusOptions = [
  { label: '创建', value: 'created' },
  { label: '生效', value: 'active' },
  { label: '锁定', value: 'locked' }
]

const permissionNameFromCode = (code, fallback) => {
  const parsed = parsePermissionCode(code)
  if (parsed?.scope === 'module') return `模块-${moduleLabel(parsed.key)}`
  if (parsed?.scope === 'app') return `应用-${getAppLabelByKey(parsed.key)}`
  if (parsed?.scope === 'op') return `${getAppLabelByKey(parsed.appKey)}-${actionLabel(parsed.actionKey || parsed.action)}`
  return formatPermissionName(code, fallback)
}

const roleLabel = getRoleLabel

const roleColumns = computed(() => ([
  { prop: 'code', label: '角色编码', editable: false },
  {
    prop: 'name',
    label: '角色名称',
    editable: true,
    valueGetter: (params) => getRoleLabel({ code: params.data?.code, name: params.data?.name }),
    valueSetter: (params) => {
      if (params.data?.name === params.newValue) return false
      params.data.name = params.newValue
      return true
    },
    formatter: (params) => getRoleLabel({ code: params.data?.code, name: params.value })
  },
  {
    prop: 'description',
    label: '说明',
    editable: true,
    valueGetter: (params) => roleDescMap[params.data?.code] || params.data?.description || '',
    valueSetter: (params) => {
      if (params.data?.description === params.newValue) return false
      params.data.description = params.newValue
      return true
    },
    formatter: (params) => roleDescMap[params.data?.code] || params.value
  },
  { prop: 'status', label: '状态', editable: true, type: 'select', width: 110,
    options: [
      { label: '创建', value: 'created' },
      { label: '生效', value: 'active' },
      { label: '锁定', value: 'locked' }
    ],
    formatter: (params) => statusLabel(params.value)
  },
  { prop: 'sort', label: '排序序号（越小越靠前）', editable: true, width: 150 }
]))

const permColumns = [
  { prop: 'module', label: '模块', width: 120, editable: false, formatter: (params) => {
    const parsed = parsePermissionCode(params.data?.code)
    if (!parsed) return ''
    if (parsed.scope === 'module') return SIDEBAR_MODULE_LABELS[parsed.key] || MODULE_LABELS[parsed.key] || parsed.key
    if (parsed.scope === 'app' || parsed.scope === 'op') {
      const key = parsed.appKey || parsed.key
      return permissionModuleLabel(key)
    }
    return ''
  } },
  { prop: 'app', label: '子应用', width: 160, editable: false, formatter: (params) => {
    const parsed = parsePermissionCode(params.data?.code)
    if (!parsed) return ''
    if (parsed.scope === 'app') return getAppLabelByKey(parsed.key)
    if (parsed.scope === 'op') return getAppLabelByKey(parsed.appKey)
    return ''
  } },
  { prop: 'action', label: '动作', width: 140, editable: true, type: 'select', options: permissionActionOptions,
    // Keep the persisted action code stable; only format the grid display.
    formatter: (params) => actionLabel(params.value) },
  {
    prop: 'name',
    label: '名称',
    editable: true,
    valueFormatter: (params) => permissionNameFromCode(params.data?.code, params.value)
  },
  { prop: 'granted', label: '是否有权限', editable: true, type: 'check', allowDoubleClickToggle: true, width: 180, minWidth: 180, suppressSizeToFit: true, headerClass: 'perm-granted-header' },
  { prop: 'code', label: '权限码', editable: false, width: 240 },
  { prop: 'assignment_status', label: '授权状态', editable: true, type: 'select', options: aclStatusOptions, width: 110, formatter: (params) => statusLabel(params.value) },
  aclDateColumn('created_at', '创建日期', 'assignment_created_at'),
  aclDateColumn('updated_at', '更新日期', 'assignment_updated_at')
]

const scopeColumns = computed(() => ([
  { prop: 'role_id', label: '角色ID', editable: false, width: 220 },
  { prop: 'module_group', label: '模块', width: 120, editable: false, formatter: (params) => {
    return scopeModuleGroupLabel(params.data?.module)
  } },
  { prop: 'module', label: '应用', width: 160, editable: false, formatter: (params) => {
    // The scope view owns the canonical label for both static and dynamic
    // apps. Fall back to the client catalog for older API responses.
    return params.data?.module_label || moduleLabel(params.value)
  } },
  { prop: 'scope_status', label: '范围状态', width: 110, editable: true, type: 'select', options: aclStatusOptions, formatter: (params) => statusLabel(params.value) },
  aclDateColumn('created_at', '创建日期', 'scope_created_at'),
  aclDateColumn('updated_at', '更新日期', 'scope_updated_at'),
  { prop: 'scope_type', label: '范围', width: 140, editable: true, type: 'select',
    options: [
      { label: '仅本人', value: 'self' },
      { label: '本部门', value: 'dept' },
      { label: '含子部门', value: 'dept_tree' },
      { label: '全公司', value: 'all' }
    ]
  },
  { prop: 'dept_id', label: '指定部门', width: 180, editable: true, type: 'select',
    options: departments.value.map((dept) => ({
      label: dept.name,
      value: dept.id
    })),
    formatter: (params) => {
      const id = params.value
      return departments.value.find((dept) => String(dept.id) === String(id))?.name
        || params.data?.dept_name
        || ''
    }
  }
]))

const fieldColumns = computed(() => ([
  { prop: 'role_id', label: '角色ID', editable: false, width: 220 },
  { prop: 'module', label: '模块', width: 160, editable: false, type: 'select',
    options: modules.value.map(m => ({ label: moduleLabel(m), value: m }))
  },
  { prop: 'field_code', label: '列', width: 200, editable: false, formatter: (params) => {
    const code = params.value
    const moduleKey = params.data?.module || fieldModule.value
    const label = fieldLabelMap.value[`${moduleKey}:${code}`]
      || fieldLabelMap.value[code]
      || FIELD_LABELS[moduleKey]?.[code]
    return label || code || '未命名字段'
  } },
  { prop: 'can_view', label: '可见', editable: true, type: 'check', allowDoubleClickToggle: true },
  { prop: 'can_edit', label: '可编辑', editable: true, type: 'check', allowDoubleClickToggle: true },
  { prop: 'status', label: '状态', width: 110, editable: true, type: 'select', options: aclStatusOptions, formatter: (params) => statusLabel(params.value) },
  aclDateColumn('created_at', '创建日期', 'created_at'),
  aclDateColumn('updated_at', '更新日期', 'updated_at')
]))

const roleColumnsDisplay = computed(() => roleColumns.value.filter(col => col.prop !== 'code'))
const scopeColumnsDisplay = computed(() => scopeColumns.value.filter(col => col.prop !== 'role_id'))
const fieldColumnsDisplay = computed(() => fieldColumns.value.filter(col => col.prop !== 'role_id'))
const permColumnsModule = computed(() => {
  return permColumns.filter(col => col.prop !== 'app' && col.prop !== 'code')
})
const permColumnsApp = computed(() => permColumns.filter(col => col.prop !== 'code'))
const permColumnsOp = computed(() => permColumns.filter(col => col.prop !== 'code'))

const aclGridContextConfig = computed(() => ({
  roles: {
    view: 'acl-roles',
    viewId: 'hr_acl_roles',
    apiUrl: '/v_roles_manage?order=sort.asc',
    writeUrl: '/v_roles_manage',
    columns: roleColumnsDisplay.value
  },
  'perm-module': {
    view: 'acl-permissions-module',
    viewId: 'hr_acl_permissions_module',
    apiUrl: permModuleApiUrl.value,
    writeUrl: '/v_role_permissions_matrix',
    columns: permColumnsModule.value
  },
  'perm-app': {
    view: 'acl-permissions-app',
    viewId: 'hr_acl_permissions_app',
    apiUrl: permAppApiUrl.value,
    writeUrl: '/v_role_permissions_matrix',
    columns: permColumnsApp.value
  },
  'perm-op': {
    view: 'acl-permissions-operation',
    viewId: 'hr_acl_permissions_op',
    apiUrl: permOpApiUrl.value,
    writeUrl: '/v_role_permissions_matrix',
    columns: permColumnsOp.value
  },
  field: {
    view: 'acl-fields',
    viewId: 'hr_acl_fields',
    apiUrl: fieldApiUrl.value,
    writeUrl: '/sys_field_acl',
    columns: fieldColumnsDisplay.value
  },
  scope: {
    view: 'acl-scopes',
    viewId: 'hr_acl_scopes',
    apiUrl: scopeApiUrl.value,
    writeUrl: '/v_role_data_scopes_matrix',
    columns: scopeColumnsDisplay.value
  }
}))

const syncAclGridAiContext = (key, rows = [], payload = null) => {
  const cfg = aclGridContextConfig.value[key]
  if (!cfg) return
  const previous = lastGridLoadStateMap.value[key] || buildGridLoadState()
  const searchText = lastSearchTextMap.value[key] || ''
  lastGridLoadStateMap.value = {
    ...lastGridLoadStateMap.value,
    [key]: pushStandardGridAgentContext({
      pushAiContext,
      app: 'hr',
      view: cfg.view,
      viewId: cfg.viewId,
      apiUrl: cfg.apiUrl,
      writeUrl: cfg.writeUrl,
      profile: 'public',
      contentProfile: 'public',
      staticColumns: cfg.columns,
      extraColumns: [],
      summaryConfig: {
        roles: roleSummary,
        'perm-module': permissionSummary,
        'perm-app': permissionSummary,
        'perm-op': permissionSummary,
        field: fieldSummary,
        scope: scopeSummary
      }[key] || roleSummary,
      rows,
      visibleRows: rows,
      payload,
      previousLoadState: previous,
      searchText,
      summaryScope: 'server',
      allowImport: false,
      additionalContext: {
        activeTab: key,
        currentRoleId: currentRoleId.value || ''
      }
    })
  }
}

const handleGridDataLoaded = (key, payload) => {
  const rows = Array.isArray(payload?.rawRows)
    ? payload.rawRows
    : (Array.isArray(payload?.rows) ? payload.rows : [])
  const visibleRows = Array.isArray(payload?.rows) ? payload.rows : rows
  lastSearchTextMap.value = {
    ...lastSearchTextMap.value,
    [key]: payload?.searchText || ''
  }
  syncAclGridAiContext(key, visibleRows, payload)
}

const handleGridDataLoadError = (key) => {
  lastGridLoadStateMap.value = {
    ...lastGridLoadStateMap.value,
    [key]: buildGridLoadState()
  }
  syncAclGridAiContext(key, [], {})
}

let permissionReloadTimer = null
let roleLifecycleReloadTimer = null
const handleRoleChanged = (event) => {
  if (event?.colDef?.field !== 'status' || !event?.data?.id) return
  const role = roles.value.find((item) => String(item?.id) === String(event.data.id))
  if (role) role.status = event.newValue
  if (roleLifecycleReloadTimer) clearTimeout(roleLifecycleReloadTimer)
  roleLifecycleReloadTimer = setTimeout(async () => {
    await loadRoles()
    await refreshRoleScoped()
  }, 400)
}

const handlePermissionChanged = () => {
  if (permissionReloadTimer) clearTimeout(permissionReloadTimer)
  permissionReloadTimer = setTimeout(() => {
    permsModuleGridRef.value?.loadData?.()
    permsAppGridRef.value?.loadData?.()
    permsOpGridRef.value?.loadData?.()
    if (activeTab.value === 'field') {
      fieldGridRef.value?.loadData?.()
    }
  }, 300)
}

const handleFieldAclChanged = (event) => {
  if (!event?.node || event.node.rowPinned) return
  const field = event?.colDef?.field
  if (field === 'can_edit' && event.newValue === true) {
    if (event.data?.can_view !== true) {
      event.node.setDataValue('can_view', true)
    }
  }
  if (field === 'can_view' && event.newValue === false) {
    if (event.data?.can_edit === true) {
      event.node.setDataValue('can_edit', false)
    }
  }
}

const loadRoles = async () => {
  const res = await request({ url: '/roles?order=sort.asc', method: 'get', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' } })
  roles.value = Array.isArray(res) ? res : []
  const selectedRoleStillExists = roles.value.some(role => String(role?.id) === String(currentRoleId.value))
  if (!selectedRoleStillExists) currentRoleId.value = roles.value[0]?.id || ''
}

const handleRoleDeleted = async () => {
  await loadRoles()
  await refreshRoleScoped()
}

const buildPermissionPayload = (app, moduleKey, roles = ['super_admin']) => {
  if (!moduleKey) return []
  const appName = app?.name || moduleKey
  const actions = [
    ['view', '查看'], ['create', '新增'], ['edit', '编辑'], ['delete', '删除'],
    ['import', '导入'], ['export', '导出'], ['config', '配置'],
    ['workflow_start', '流程发起'], ['workflow_transition', '流程流转'],
    ['workflow_complete', '流程完结'], ['status_transition', '状态变更']
  ]
  let config = app?.config || {}
  if (typeof config === 'string') {
    try { config = JSON.parse(config) } catch { config = {} }
  }
  const configuredOps = [config?.ops, config?.businessOps, config?.operationPermissions, app?.ops]
    .flatMap((value) => {
      if (Array.isArray(value)) return value.map(item => ({ key: '', value: item }))
      if (value && typeof value === 'object') {
        return Object.entries(value).map(([key, item]) => ({ key, value: item }))
      }
      return []
    })
    .map(({ key, value }) => {
      if (value === false || value === null || value === undefined) return ''
      const objectValue = value && typeof value === 'object'
        ? (value.code || value.permission || value.action || value.value || '')
        : value
      const raw = String(objectValue || (value === true ? key : '') || '').trim()
      if (raw.startsWith(`op:${moduleKey}.`)) return raw.slice(`op:${moduleKey}.`.length)
      if (raw.startsWith('op:')) return ''
      // App Center configs may store either an action name or a shorthand
      // operation key instead of the canonical op:<module>.<action> code.
      return raw || String(key || '').trim()
    })
    .filter(Boolean)
  const actionKeys = Array.from(new Set([...actions.map(([key]) => key), ...configuredOps]))
  return [
    { code: `app:${moduleKey}`, name: `应用-${appName}`, module: appName, action: '进入', roles },
    ...actionKeys.map((key) => ({
      code: `op:${moduleKey}.${key}`,
      name: `${appName}-${OP_ACTION_LABELS[key] || actionLabel(key)}`,
      module: appName,
      action: key,
      roles
    }))
  ]
}

const dedupePermissionPayload = (items) => {
  const byCode = new Map()
  ;(Array.isArray(items) ? items : []).forEach((item) => {
    const code = String(item?.code || '').trim()
    if (code) byCode.set(code, item)
  })
  return Array.from(byCode.values())
}

const syncModules = () => {
  const dynamic = appCenterApps.value
    .filter(isAclVisibleApp)
    .map(resolveAppModuleKey)
    .filter(Boolean)
  const merged = Array.from(new Set([...baseModules, ...dynamic]))
  modules.value = merged
  if (!fieldModule.value && merged.length) {
    fieldModule.value = merged[0]
  }
}

const loadAppCenterApps = async () => {
  const payload = buildStaticPermissionPayload().map((item) => ({
    ...item,
    roles: ['super_admin']
  }))
  try {
    const res = await request({
      url: '/apps?order=created_at.desc',
      method: 'get',
      headers: { 'Accept-Profile': 'app_center', 'Content-Profile': 'app_center' }
    })
    appCenterApps.value = Array.isArray(res) ? res : []
    syncModules()
    appCenterApps.value.forEach((app) => {
      if (!isAclVisibleApp(app)) return
      const moduleKey = resolveAppModuleKey(app)
      payload.push(...buildPermissionPayload(app, moduleKey))
    })
  } catch (e) {
    appCenterApps.value = []
    syncModules()
  }
  const uniquePayload = dedupePermissionPayload(payload)
  if (uniquePayload.length) {
    try {
      await request({
        url: '/rpc/upsert_permissions',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { payload: uniquePayload }
      })
    } catch (e) {
      // The formal migration owns this RPC. A legacy database must not prevent
      // the permission page from rendering its complete static catalog.
      console.warn('ensure application permissions failed', e)
    }
  }
  try {
    await request({
      url: '/rpc/upsert_permissions',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { payload: buildModulePermissionPayload() }
    })
    permsModuleGridRef.value?.loadData()
  } catch (e) {
    console.warn('ensure module permissions failed', e)
  }
  if (activeTab.value === 'field') {
    const fieldModules = modules.value.filter((moduleKey) => (
      isDynamicAclModule(moduleKey) || getStaticColumnsByModule(moduleKey).length > 0
    ))
    await ensureFieldAclForModules(fieldModules)
  }
}

const loadDepartments = async () => {
  try {
    const res = await request({
      url: '/departments?select=id,name,parent_id,status&order=sort.asc,name.asc',
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    departments.value = Array.isArray(res)
      ? res.filter((dept) => String(dept?.status || 'active').toLowerCase() !== 'archived')
      : []
  } catch (e) {
    departments.value = []
    console.warn('load departments for data scopes failed', e)
  }
}

const scheduleDepartmentsReload = () => {
  if (departmentsReloadTimer) return
  departmentsReloadTimer = setTimeout(async () => {
    departmentsReloadTimer = null
    await loadDepartments()
    if (activeTab.value === 'scope') scopeGridRef.value?.loadData?.()
  }, 300)
}

const parseRealtimePayload = (event) => {
  if (!event) return null
  if (typeof event.payload === 'string') {
    try { return JSON.parse(event.payload) } catch { return null }
  }
  return event.payload && typeof event.payload === 'object' ? event.payload : event
}

const handleDepartmentRealtimeEvent = (event) => {
  const payload = parseRealtimePayload(event)
  if (payload?.schema === 'public' && payload?.table === 'departments') {
    scheduleDepartmentsReload()
  }
}

const scopeApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_data_scopes_matrix?limit=0'
  let base = `/v_role_data_scopes_matrix?role_id=eq.${currentRoleId.value}`
  if (scopeApp.value) {
    base += `&module=eq.${scopeApp.value}`
  } else if (scopeModuleGroup.value) {
    base += scopeModuleGroup.value === 'app'
      ? buildAclKeyOrFilter(key => `module.eq.${encodeURIComponent(key)}`)
      : `&module=like.${scopeModuleGroup.value}_%`
  }
  return `${base}&order=module.asc`
})

const fieldApiUrl = computed(() => {
  if (!currentRoleId.value) return '/sys_field_acl?order=module.asc,field_code.asc'
  if (fieldModule.value) {
    const codes = allowedFieldCodes.value
    if (!codes.length) {
      return `/sys_field_acl?role_id=eq.${currentRoleId.value}&module=eq.${fieldModule.value}&limit=0`
    }
    const inFilter = codes.length
      ? `&field_code=in.(${codes.map(c => encodeURIComponent(c)).join(',')})`
      : ''
    return `/sys_field_acl?role_id=eq.${currentRoleId.value}&module=eq.${fieldModule.value}${inFilter}&order=field_code.asc`
  }
  if (fieldModuleGroup.value) {
    if (fieldModuleGroup.value === 'app') {
      return `/sys_field_acl?role_id=eq.${currentRoleId.value}${buildAclKeyOrFilter(key => `module.eq.${encodeURIComponent(key)}`)}&order=module.asc,field_code.asc`
    }
    const prefix = fieldModuleGroup.value + '_'
    return `/sys_field_acl?role_id=eq.${currentRoleId.value}&module=like.${prefix}%&order=module.asc,field_code.asc`
  }
  return `/sys_field_acl?role_id=eq.${currentRoleId.value}&order=module.asc,field_code.asc`
})

const moduleFilters = computed(() => SIDEBAR_MODULE_KEYS.map((value) => ({
  value,
  label: SIDEBAR_MODULE_LABELS[value] || MODULE_LABELS[value] || value
})))

const matchesModuleGroup = (appKey, group) => {
  if (!group) return true
  if (group === 'app') return appKey?.startsWith('app_') || !!appCenterModuleMap.value[appKey]
  return appKey?.startsWith(`${group}_`)
}

const permAppOptions = computed(() => {
  return modules.value
    .filter((key) => matchesModuleGroup(key, permModuleGroup.value))
    .map((key) => ({ value: key, label: moduleLabel(key) }))
})

const fieldModuleOptions = computed(() => {
  return modules.value
    .filter((key) => matchesModuleGroup(key, fieldModuleGroup.value))
    .map((key) => ({ value: key, label: moduleLabel(key) }))
})

const scopeAppOptions = computed(() => {
  return modules.value
    .filter((key) => matchesModuleGroup(key, scopeModuleGroup.value))
    .map((key) => ({ value: key, label: moduleLabel(key) }))
})

const staticAclKeys = computed(() => (Array.isArray(STATIC_APP_CATALOG) ? STATIC_APP_CATALOG : [])
  .map(app => String(app?.key || '').trim())
  .filter(Boolean))
const dynamicAclKeys = computed(() => Array.from(new Set([
  ...staticAclKeys.value,
  ...Object.keys(appCenterModuleMap.value)
])))

const buildAclKeyOrFilter = (clause) => {
  const clauses = dynamicAclKeys.value.map((key) => clause(key))
  return clauses.length ? `&or=(${clauses.join(',')})` : '&limit=0'
}

// 模块/子应用筛选在列权限使用

const permModuleApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_permissions_matrix?limit=0'
  const moduleCodes = SIDEBAR_MODULE_KEYS
    .map((key) => encodeURIComponent(`module:${key}`))
    .join(',')
  let base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=in.(${moduleCodes})`
  return `${base}&order=code.asc`
})

const permAppApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_permissions_matrix?limit=0'
  let base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.app:%`
  if (permApp.value) {
    base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=eq.app:${permApp.value}`
  } else if (permModuleGroup.value) {
    base = permModuleGroup.value === 'app'
      ? `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}${buildAclKeyOrFilter(key => `code.eq.app:${encodeURIComponent(key)}`)}`
      : `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.app:${permModuleGroup.value}_%`
  }
  return `${base}&order=code.asc`
})

const permOpApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_permissions_matrix?limit=0'
  let base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.op:%`
  if (permApp.value) {
    base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.op:${permApp.value}.%`
  } else if (permModuleGroup.value) {
    base = permModuleGroup.value === 'app'
      ? `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}${buildAclKeyOrFilter(key => `code.like.op:${encodeURIComponent(key)}.%`)}`
      : `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.op:${permModuleGroup.value}_%.%`
  }
  return `${base}&order=code.asc`
})

const refreshRoleScoped = async () => {
  if (rolesGridRef.value?.loadData) rolesGridRef.value.loadData()
  if (permsModuleGridRef.value?.loadData) permsModuleGridRef.value.loadData()
  if (permsAppGridRef.value?.loadData) permsAppGridRef.value.loadData()
  if (permsOpGridRef.value?.loadData) permsOpGridRef.value.loadData()
  if (scopeGridRef.value?.loadData) scopeGridRef.value.loadData()
  if (fieldGridRef.value?.loadData) fieldGridRef.value.loadData()
}

const handleConfigColumns = () => {
  ElMessage.info('权限管理暂不支持自定义列')
}

const applyRoleTemplates = async () => {
  try {
    await request({
      url: '/rpc/apply_role_permission_templates',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    ElMessage.success('默认模板已应用')
  } catch (e) {
    console.error(e)
    ElMessage.error('应用模板失败')
  }
}

const fieldLabelMap = ref({})
const allowedFieldCodes = ref([])

const normalizeConfig = (raw) => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const normalizeAppColumns = (columns) => {
  if (!Array.isArray(columns)) return []
  return columns
    .map((col) => {
      if (!col) return null
      if (typeof col === 'string') {
        return { prop: col, label: col }
      }
      const prop = col.prop || col.field || ''
      const label = col.label || prop
      return prop ? { prop, label } : null
    })
    .filter(Boolean)
}

const fetchAppCenterColumns = (moduleKey) => {
  const app = appCenterModuleMap.value[moduleKey]
  if (!app) return []
  const config = normalizeConfig(app?.config)
  return normalizeAppColumns(config?.columns)
}

const getConfigKeyByModule = (moduleKey) => {
  if (isDynamicAclModule(moduleKey)) return ''
  const map = {
    hr_employee: 'hr_table_cols',
    hr_change: 'hr_transfer_cols',
    hr_attendance: 'hr_attendance_cols',
    mms_ledger: 'materials_table_cols',
    hr_user: 'hr_user_cols',
    sales_customer: 'sales_customers_cols',
    sales_follow_up: 'sales_follow_ups_cols',
    sales_opportunity: 'sales_opportunities_cols',
    sales_order: 'sales_orders_cols',
    sales_payment: 'sales_payments_cols',
    purchase_supplier: 'purchase_suppliers_cols',
    purchase_demand: 'purchase_demands_cols',
    purchase_order: 'purchase_orders_cols',
    purchase_arrival: 'purchase_arrivals_cols',
    mms_bom: 'production_bom_list_cols',
    production_plan: 'production_plans_cols',
    production_work_order: 'production_work_orders_cols',
    quality_inspection: 'quality_inspections_cols',
    quality_ncr: 'quality_ncrs_cols',
    quality_action: 'quality_corrective_actions_cols',
    quality_audit: 'quality_audits_cols',
    quality_standard: 'quality_standards_cols',
    equipment_asset: 'equipment_assets_cols',
    equipment_check: 'equipment_checks_cols',
    equipment_issue: 'equipment_issues_cols',
    equipment_work_order: 'equipment_work_orders_cols',
    equipment_plan: 'equipment_maintenance_plans_cols',
    equipment_standard: 'equipment_standards_cols'
  }
  return map[moduleKey] || ''
}

const getStaticColumnsByModule = (moduleKey) => {
  if (isDynamicAclModule(moduleKey)) {
    return fetchAppCenterColumns(moduleKey)
  }
  const app = HR_APPS.find(item => item.aclModule === moduleKey)
  const declaredColumns = [
    ...(Array.isArray(app?.staticColumns) ? app.staticColumns : []),
    ...(Array.isArray(app?.defaultExtraColumns) ? app.defaultExtraColumns : [])
  ]
  if (declaredColumns.length) {
    return Array.from(new Map(declaredColumns
      .filter(col => col?.prop)
      .map(col => [col.prop, col])).values())
  }
  const catalogColumns = businessFieldColumns(moduleKey)
  if (catalogColumns.length) return catalogColumns
  // Dashboard/overview entries are permissions targets, not data grids.
  // Do not invent HR columns for an app that has no field catalog.
  return []
}

const MMS_LEDGER_ALLOWED_FIELDS = [
  'batch_no',
  'name',
  'category',
  'spec',
  'unit',
  'measure_unit',
  'conversion_ratio',
  'conversion',
  'finance_attribute',
  'created_by'
]

const buildAllowedFieldCodeSet = async (moduleKey) => {
  const set = new Set()
  if (!moduleKey) return set
  if (isDynamicAclModule(moduleKey)) {
    const configCols = await fetchAppCenterColumns(moduleKey)
    configCols.forEach(col => {
      if (col?.prop) set.add(col.prop)
    })
    return set
  }
  if (moduleKey === 'mms_ledger') {
    MMS_LEDGER_ALLOWED_FIELDS.forEach(code => set.add(code))
  } else {
    const staticCols = getStaticColumnsByModule(moduleKey) || []
    staticCols.forEach(col => {
      if (col?.prop) set.add(col.prop)
    })
    const fallbackLabels = FIELD_LABELS[moduleKey] || {}
    Object.keys(fallbackLabels).forEach(code => set.add(code))
  }
  const configCols = await fetchConfigColumns(moduleKey)
  configCols.forEach(col => {
    if (col?.prop) set.add(col.prop)
  })
  return set
}

const loadAllowedFieldCodes = async (moduleKey) => {
  if (!moduleKey) {
    allowedFieldCodes.value = []
    return
  }
  const set = await buildAllowedFieldCodeSet(moduleKey)
  allowedFieldCodes.value = Array.from(set)
}

const fetchConfigColumns = async (moduleKey) => {
  if (isDynamicAclModule(moduleKey)) {
    return fetchAppCenterColumns(moduleKey)
  }
  const configKey = getConfigKeyByModule(moduleKey)
  if (!configKey) return []
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const raw = Array.isArray(res) && res.length ? res[0].value : []
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    return []
  }
}

const loadFieldLabelMap = async () => {
  const selectedModules = fieldModule.value
    ? [fieldModule.value]
    : (fieldModuleGroup.value
      ? modules.value.filter((key) => matchesModuleGroup(key, fieldModuleGroup.value))
      : modules.value)
  if (!selectedModules.length) {
    fieldLabelMap.value = {}
    return
  }
  const map = {}
  await Promise.all(selectedModules.map(async (moduleKey) => {
    const allowedSet = moduleKey === fieldModule.value ? new Set(allowedFieldCodes.value) : new Set()
    try {
      const res = await request({
        url: `/v_field_labels?module=eq.${encodeURIComponent(moduleKey)}`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      if (Array.isArray(res)) {
        res.forEach((row) => {
          if (!row?.field_code) return
          const raw = row?.field_label || ''
          const code = row.field_code
          if (allowedSet.size && !allowedSet.has(code)) return
          const normalized = String(raw).trim()
          const looksLikeCode = /^[a-z0-9_]+$/i.test(normalized)
          if (!normalized || normalized === '???' || normalized === '？？？' || looksLikeCode) return
          map[`${moduleKey}:${code}`] = normalized
          if (selectedModules.length === 1) map[code] = normalized
        })
      }
    } catch (e) {
      console.warn(`load field labels failed: ${moduleKey}`, e)
    }
    const fallbackLabels = FIELD_LABELS[moduleKey] || {}
    Object.keys(fallbackLabels).forEach((code) => {
      if (allowedSet.size && !allowedSet.has(code)) return
      if (!map[`${moduleKey}:${code}`]) map[`${moduleKey}:${code}`] = fallbackLabels[code]
      if (selectedModules.length === 1 && !map[code]) map[code] = fallbackLabels[code]
    })
    getStaticColumnsByModule(moduleKey).forEach((col) => {
      if (!col?.prop || !col?.label || (allowedSet.size && !allowedSet.has(col.prop))) return
      if (!map[`${moduleKey}:${col.prop}`]) map[`${moduleKey}:${col.prop}`] = col.label
      if (selectedModules.length === 1 && !map[col.prop]) map[col.prop] = col.label
    })
    businessFieldColumns(moduleKey).forEach((col) => {
      if (!col?.prop || (allowedSet.size && !allowedSet.has(col.prop))) return
      if (!map[`${moduleKey}:${col.prop}`]) map[`${moduleKey}:${col.prop}`] = col.label
      if (selectedModules.length === 1 && !map[col.prop]) map[col.prop] = col.label
    })
    const configCols = await fetchConfigColumns(moduleKey)
    configCols.forEach((col) => {
      if (!col?.prop || !col?.label || (allowedSet.size && !allowedSet.has(col.prop))) return
      if (!map[`${moduleKey}:${col.prop}`]) map[`${moduleKey}:${col.prop}`] = col.label
      if (selectedModules.length === 1 && !map[col.prop]) map[col.prop] = col.label
    })
  }))
  fieldLabelMap.value = map
}

const ensureFieldAclForModule = async (moduleKey) => {
  if (!moduleKey) return
  if (isDynamicAclModule(moduleKey)) {
    try {
      const configCols = fetchAppCenterColumns(moduleKey)
      const payload = configCols.map(col => col.prop).filter(Boolean)
      if (payload.length === 0) return
      await request({
        url: '/rpc/ensure_field_acl',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { module_name: moduleKey, field_codes: payload }
      })
    } catch (e) {
      console.warn('ensure field acl failed', e)
    }
    return
  }
  if (moduleKey === 'mms_ledger') {
    try {
      const allowedSet = await buildAllowedFieldCodeSet(moduleKey)
      const payload = Array.from(allowedSet).filter(Boolean)
      if (payload.length === 0) return
      await request({
        url: '/rpc/ensure_field_acl',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { module_name: moduleKey, field_codes: payload }
      })
    } catch (e) {
      console.warn('ensure field acl failed', e)
    }
    return
  }
  try {
    const res = await request({
      url: `/v_field_labels?module=eq.${moduleKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const codes = new Set()
    if (Array.isArray(res)) {
      res.forEach((row) => {
        if (row?.field_code) codes.add(row.field_code)
      })
    }
    const fallbackLabels = FIELD_LABELS[moduleKey] || {}
    Object.keys(fallbackLabels).forEach((code) => codes.add(code))
    getStaticColumnsByModule(moduleKey).forEach((col) => {
      if (col?.prop) codes.add(col.prop)
    })
    businessFieldColumns(moduleKey).forEach((col) => {
      if (col?.prop) codes.add(col.prop)
    })
    const configCols = await fetchConfigColumns(moduleKey)
    configCols.forEach((col) => {
      if (col?.prop) codes.add(col.prop)
    })
    const payload = Array.from(codes).filter(Boolean)
    if (payload.length === 0) return
    await request({
      url: '/rpc/ensure_field_acl',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { module_name: moduleKey, field_codes: payload }
    })
  } catch (e) {
    console.warn('ensure field acl failed', e)
  }
}

const ensureFieldAclForModules = async (moduleKeys = modules.value) => {
  const keys = Array.from(new Set(Array.isArray(moduleKeys) ? moduleKeys : []))
  await Promise.all(keys.map((moduleKey) => ensureFieldAclForModule(moduleKey)))
}

watchEffect(() => {
  if (activeTab.value === 'field' && !fieldModule.value && !fieldModuleGroup.value && modules.value.length) {
    fieldModule.value = modules.value[0]
  }
})

watchEffect(() => {
  if (activeTab.value === 'field') {
    ensureFieldAclForModule(fieldModule.value).then(async () => {
      await loadAllowedFieldCodes(fieldModule.value)
      loadFieldLabelMap()
      fieldGridRef.value?.loadData?.()
    })
  }
})

watch([fieldModule, fieldModuleGroup], async () => {
  if (activeTab.value === 'field') {
    await ensureFieldAclForModule(fieldModule.value)
    await loadAllowedFieldCodes(fieldModule.value)
    await loadFieldLabelMap()
    fieldGridRef.value?.loadData()
  }
})

watch(permModuleGroup, () => {
  if (permApp.value && !matchesModuleGroup(permApp.value, permModuleGroup.value)) {
    permApp.value = ''
  }
})

watch(fieldModuleGroup, () => {
  if (fieldModule.value && !matchesModuleGroup(fieldModule.value, fieldModuleGroup.value)) {
    fieldModule.value = ''
  }
})

watch(scopeModuleGroup, () => {
  if (scopeApp.value && !matchesModuleGroup(scopeApp.value, scopeModuleGroup.value)) {
    scopeApp.value = ''
  }
})

watch([scopeModuleGroup, scopeApp], () => {
  if (activeTab.value === 'scope') scopeGridRef.value?.loadData()
})

watch([permModuleGroup, permApp], () => {
  if (activeTab.value === 'perm-app') permsAppGridRef.value?.loadData()
  if (activeTab.value === 'perm-op') permsOpGridRef.value?.loadData()
})

watch(activeTab, async () => {
  if (activeTab.value === 'perm-module') permsModuleGridRef.value?.loadData()
  if (activeTab.value === 'perm-app') permsAppGridRef.value?.loadData()
  if (activeTab.value === 'perm-op') permsOpGridRef.value?.loadData()
  if (['perm-app', 'perm-op', 'field', 'scope'].includes(activeTab.value)) {
    await loadAppCenterApps()
  }
  if (activeTab.value === 'scope') {
    await loadDepartments()
    scopeGridRef.value?.loadData?.()
  }
})

watch(currentRoleId, () => {
  if (permsModuleGridRef.value?.loadData) permsModuleGridRef.value.loadData()
  if (permsAppGridRef.value?.loadData) permsAppGridRef.value.loadData()
  if (permsOpGridRef.value?.loadData) permsOpGridRef.value.loadData()
  if (scopeGridRef.value?.loadData) scopeGridRef.value.loadData()
})

const handleCreate = async (type) => {
  try {
    if (type === 'roles') {
      const code = `role_${Date.now().toString().slice(-6)}`
      await request({
        url: '/roles',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { code, name: '新角色', description: '', status: 'created', sort: 100 }
      })
      rolesGridRef.value?.loadData()
      await loadRoles()
      ElMessage.success('已新增角色')
      return
    }

    if (type === 'permissions') {
      const suffix = Date.now().toString().slice(-6)
      const appKey = permApp.value || 'hr_employee'
      let code = `op:${appKey}.custom_${suffix}`
      let name = `${moduleLabel(appKey)}-自定义`
      let action = '自定义'
      if (activeTab.value === 'perm-module') {
        const group = permModuleGroup.value || 'hr'
        code = `module:${group}`
        name = `模块-${group}`
        action = '显示'
      } else if (activeTab.value === 'perm-app') {
        code = `app:${appKey}`
        name = `应用-${moduleLabel(appKey)}`
        action = '进入'
      }
      await request({
        url: '/permissions',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: {
          module: moduleLabel(appKey),
          action,
          code,
          name
        }
      })
      permsModuleGridRef.value?.loadData()
      permsAppGridRef.value?.loadData()
      permsOpGridRef.value?.loadData()
      ElMessage.success('已新增权限点')
      return
    }

    if (type === 'scopes') {
      if (!currentRoleId.value) {
        ElMessage.warning('请先选择角色')
        return
      }
      await request({
        url: '/role_data_scopes',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: {
          role_id: currentRoleId.value,
          module: scopeApp.value || modules.value[0] || 'hr_employee',
          scope_type: 'dept'
        }
      })
      scopeGridRef.value?.loadData()
      ElMessage.success('已新增数据范围')
      return
    }

    if (type === 'fields') {
      if (!currentRoleId.value) {
        ElMessage.warning('请先选择角色')
        return
      }
      if (!fieldModule.value) {
        ElMessage.warning('请先选择模块')
        return
      }
      await request({
        url: '/sys_field_acl',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: {
          role_id: currentRoleId.value,
          module: fieldModule.value,
          field_code: `field_${Date.now().toString().slice(-4)}`,
          can_view: true,
          can_edit: true
        }
      })
      fieldGridRef.value?.loadData()
      ElMessage.success('已新增字段权限')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('新增失败')
  }
}

onMounted(async () => {
  await loadRoles()
  await Promise.all([loadAppCenterApps(), loadDepartments()])
  departmentsRealtimeUnsub = getRealtimeClient().subscribe(handleDepartmentRealtimeEvent)
})

onUnmounted(() => {
  if (departmentsRealtimeUnsub) departmentsRealtimeUnsub()
  departmentsRealtimeUnsub = null
  if (departmentsReloadTimer) {
    clearTimeout(departmentsReloadTimer)
    departmentsReloadTimer = null
  }
  if (roleLifecycleReloadTimer) {
    clearTimeout(roleLifecycleReloadTimer)
    roleLifecycleReloadTimer = null
  }
})
</script>

<style scoped>
.acl-view {
  padding: 16px;
}
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}
.role-label {
  font-size: 14px;
  color: #606266;
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.title {
  font-size: 18px;
  font-weight: 600;
}
.tabs {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
}
.grid-wrap {
  height: 520px;
  min-height: 420px;
}
.table-toolbar {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.filter-label {
  font-size: 12px;
  color: #909399;
}
.hint {
  color: #909399;
  font-size: 12px;
}
</style>
