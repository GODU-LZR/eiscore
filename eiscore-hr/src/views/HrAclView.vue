<template>
  <div class="acl-view">
    <div class="header">
      <div class="title">角色与权限管理</div>
      <div class="role-label">当前设置角色：</div>
      <el-select v-model="currentRoleId" placeholder="选择角色" style="width: 240px" @change="refreshRoleScoped">
        <el-option v-for="r in roles" :key="r.id" :label="roleLabel(r)" :value="r.id" />
      </el-select>
      <div class="header-actions">
        <el-button type="success" plain @click="applyRoleTemplates">应用默认模板</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane label="角色列表" name="roles">
        <div class="grid-wrap">
          <eis-data-grid
            ref="rolesGridRef"
            view-id="hr_acl_roles"
            api-url="/v_roles_manage?order=sort.asc"
            write-url="/v_roles_manage"
            :include-properties="false"
            :static-columns="roleColumnsDisplay"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :auto-size-columns="false"
            default-order=""
            @create="handleCreate('roles')"
            @config-columns="handleConfigColumns"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="模块权限" name="perm-module">
        <div class="grid-wrap">
          <eis-data-grid
            ref="permsModuleGridRef"
            view-id="hr_acl_permissions_module"
            :api-url="permModuleApiUrl"
            write-url="/v_role_permissions_matrix"
            write-mode="patch"
            :patch-required-fields="['role_id','permission_id']"
            :include-properties="false"
            :static-columns="permColumnsModule"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :auto-size-columns="false"
            default-order=""
            :can-create="false"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handlePermissionChanged"
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
            view-id="hr_acl_permissions_app"
            :api-url="permAppApiUrl"
            write-url="/v_role_permissions_matrix"
            write-mode="patch"
            :patch-required-fields="['role_id','permission_id']"
            :include-properties="false"
            :static-columns="permColumnsApp"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :auto-size-columns="false"
            default-order=""
            :can-create="false"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handlePermissionChanged"
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
            view-id="hr_acl_permissions_op"
            :api-url="permOpApiUrl"
            write-url="/v_role_permissions_matrix"
            write-mode="patch"
            :patch-required-fields="['role_id','permission_id']"
            :include-properties="false"
            :static-columns="permColumnsOp"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :auto-size-columns="false"
            default-order=""
            :can-create="false"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handlePermissionChanged"
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
            view-id="hr_acl_fields"
            :api-url="fieldApiUrl"
            write-url="/sys_field_acl"
            write-mode="patch"
            :patch-required-fields="['role_id','module','field_code']"
            :include-properties="false"
            :static-columns="fieldColumnsDisplay"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :auto-size-columns="false"
            default-order=""
            @create="handleCreate('fields')"
            @config-columns="handleConfigColumns"
            @cell-value-changed="handleFieldAclChanged"
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
            view-id="hr_acl_scopes"
            :api-url="scopeApiUrl"
            write-url="/v_role_data_scopes_matrix"
            write-mode="patch"
            :patch-required-fields="['role_id','module']"
            :include-properties="false"
            :static-columns="scopeColumnsDisplay"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            :auto-size-columns="false"
            default-order=""
            @create="handleCreate('scopes')"
            @config-columns="handleConfigColumns"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, watchEffect } from 'vue'
import request from '@/utils/request'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import { ElMessage } from 'element-plus'
import { formatPermissionName, PERMISSION_ACTION_OPTIONS, parsePermissionCode, MODULE_LABELS, APP_LABELS } from '@/utils/permission-spec'
import { FIELD_LABELS } from '@/utils/field-labels'
import { HR_APPS, BASE_STATIC_COLUMNS } from '@/utils/hr-apps'

const roles = ref([])
const modules = ref(['hr_employee', 'hr_org', 'hr_attendance', 'hr_change', 'hr_acl', 'hr_user', 'mms_ledger'])

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

const emptySummary = { label: '合计', rules: {}, expressions: {} }

const roleNameMap = {
  super_admin: '超级管理员',
  hr_admin: '人事管理员',
  hr_clerk: '人事文员',
  dept_manager: '部门主管',
  employee: '员工'
}

const roleDescMap = {
  super_admin: '拥有全部权限',
  hr_admin: '人事模块全权限',
  hr_clerk: '人事模块编辑权限',
  dept_manager: '部门管理权限',
  employee: '普通员工权限'
}

const moduleLabel = (m) => {
  const map = {
    hr_employee: '人事花名册',
    hr_org: '部门架构',
    hr_attendance: '考勤管理',
    hr_change: '调岗记录',
    hr_acl: '权限管理',
    hr_user: '用户管理',
    mms_ledger: '物料台账'
  }
  return map[m] || m
}

const actionLabel = (action) => {
  const map = {
    view: '查看',
    create: '新增',
    edit: '编辑',
    delete: '删除',
    export: '导出',
    config: '配置'
  }
  return map[action] || action
}

const permissionNameFromCode = (code, fallback) => {
  return formatPermissionName(code, fallback)
}

const roleLabel = (r) => {
  const name = roleNameMap[r.code] || r.name || r.code
  return `${name}`
}

const roleColumns = computed(() => ([
  { prop: 'code', label: '角色编码', editable: false },
  {
    prop: 'name',
    label: '角色名称',
    editable: true,
    valueFormatter: (params) => roleNameMap[params.data?.code] || params.value
  },
  {
    prop: 'description',
    label: '说明',
    editable: true,
    valueFormatter: (params) => roleDescMap[params.data?.code] || params.value
  },
  { prop: 'sort', label: '排序', editable: true, width: 100 }
]))

const permColumns = [
  { prop: 'module', label: '模块', width: 120, editable: false, formatter: (params) => {
    const parsed = parsePermissionCode(params.data?.code)
    if (!parsed) return ''
    if (parsed.scope === 'module') return MODULE_LABELS[parsed.key] || parsed.key
    if (parsed.scope === 'app' || parsed.scope === 'op') {
      const key = parsed.appKey || parsed.key
      if (key?.startsWith('hr_')) return '人事'
      if (key?.startsWith('mms_')) return '物料'
      return MODULE_LABELS[key] || ''
    }
    return ''
  } },
  { prop: 'app', label: '子应用', width: 160, editable: false, formatter: (params) => {
    const parsed = parsePermissionCode(params.data?.code)
    if (!parsed) return ''
    if (parsed.scope === 'app') return APP_LABELS[parsed.key] || parsed.key
    if (parsed.scope === 'op') return APP_LABELS[parsed.appKey] || parsed.appKey
    return ''
  } },
  { prop: 'action', label: '动作', width: 140, editable: true, type: 'select', options: PERMISSION_ACTION_OPTIONS },
  {
    prop: 'name',
    label: '名称',
    editable: true,
    valueFormatter: (params) => permissionNameFromCode(params.data?.code, params.value)
  },
  { prop: 'granted', label: '是否有权限', editable: true, type: 'check', width: 180, minWidth: 180, suppressSizeToFit: true, headerClass: 'perm-granted-header' },
  { prop: 'code', label: '权限码', editable: false, width: 240 }
]

const scopeColumns = [
  { prop: 'role_id', label: '角色ID', editable: false, width: 220 },
  { prop: 'module_group', label: '模块', width: 120, editable: false, formatter: (params) => {
    const key = params.data?.module || ''
    if (key.startsWith('hr_')) return '人事'
    if (key.startsWith('mms_')) return '物料'
    return ''
  } },
  { prop: 'module', label: '应用', width: 160, editable: false, formatter: (params) => moduleLabel(params.value) },
  { prop: 'scope_type', label: '范围', width: 140, editable: true, type: 'select',
    options: [
      { label: '仅本人', value: 'self' },
      { label: '本部门', value: 'dept' },
      { label: '含子部门', value: 'dept_tree' },
      { label: '全公司', value: 'all' }
    ]
  }
]

const fieldColumns = [
  { prop: 'role_id', label: '角色ID', editable: false, width: 220 },
  { prop: 'module', label: '模块', width: 160, editable: false, type: 'select', options: modules.value.map(m => ({ label: moduleLabel(m), value: m })) },
  { prop: 'field_code', label: '列', width: 200, editable: false, formatter: (params) => {
    const code = params.value
    const label = fieldLabelMap.value[code] || FIELD_LABELS[fieldModule.value]?.[code]
    return label || code || '未命名字段'
  } },
  { prop: 'can_view', label: '可见', editable: true, type: 'check' },
  { prop: 'can_edit', label: '可编辑', editable: true, type: 'check' }
]

const roleColumnsDisplay = computed(() => roleColumns.value.filter(col => col.prop !== 'code'))
const scopeColumnsDisplay = computed(() => scopeColumns.filter(col => col.prop !== 'role_id'))
const fieldColumnsDisplay = computed(() => fieldColumns.filter(col => col.prop !== 'role_id'))
const permColumnsModule = computed(() => {
  const cols = permColumns
    .filter(col => col.prop !== 'app' && col.prop !== 'code')
    .map((col) => {
      if (col.prop === 'action') {
        return { ...col, editable: false, type: undefined, options: undefined }
      }
      return col
    })
  return cols
})
const permColumnsApp = computed(() => permColumns.filter(col => col.prop !== 'code'))
const permColumnsOp = computed(() => permColumns.filter(col => col.prop !== 'code'))

let permissionReloadTimer = null
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
  if (!currentRoleId.value && roles.value.length) currentRoleId.value = roles.value[0].id
}

const scopeApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_data_scopes_matrix?limit=0'
  let base = `/v_role_data_scopes_matrix?role_id=eq.${currentRoleId.value}`
  if (scopeApp.value) {
    base += `&module=eq.${scopeApp.value}`
  } else if (scopeModuleGroup.value) {
    base += `&module=like.${scopeModuleGroup.value}_%`
  }
  return `${base}&order=module.asc`
})

const fieldApiUrl = computed(() => {
  if (!currentRoleId.value) return '/sys_field_acl?order=module.asc,field_code.asc'
  if (fieldModule.value) {
    return `/sys_field_acl?role_id=eq.${currentRoleId.value}&module=eq.${fieldModule.value}&order=field_code.asc`
  }
  if (fieldModuleGroup.value) {
    const prefix = fieldModuleGroup.value + '_'
    return `/sys_field_acl?role_id=eq.${currentRoleId.value}&module=like.${prefix}%&order=module.asc,field_code.asc`
  }
  return `/sys_field_acl?role_id=eq.${currentRoleId.value}&order=module.asc,field_code.asc`
})

const moduleFilters = computed(() => ([
  { label: '人事', value: 'hr' },
  { label: '物料', value: 'mms' },
  { label: '首页', value: 'home' }
]))

const matchesModuleGroup = (appKey, group) => {
  if (!group) return true
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

// 模块/子应用筛选在列权限使用

const permModuleApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_permissions_matrix?limit=0'
  let base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.module:%`
  return `${base}&order=code.asc`
})

const permAppApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_permissions_matrix?limit=0'
  let base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.app:%`
  if (permApp.value) {
    base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=eq.app:${permApp.value}`
  } else if (permModuleGroup.value) {
    base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.app:${permModuleGroup.value}_%`
  }
  return `${base}&order=code.asc`
})

const permOpApiUrl = computed(() => {
  if (!currentRoleId.value) return '/v_role_permissions_matrix?limit=0'
  let base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.op:%`
  if (permApp.value) {
    base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.op:${permApp.value}.%`
  } else if (permModuleGroup.value) {
    base = `/v_role_permissions_matrix?role_id=eq.${currentRoleId.value}&code=like.op:${permModuleGroup.value}_%`
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

const getConfigKeyByModule = (moduleKey) => {
  const map = {
    hr_employee: 'hr_table_cols',
    hr_change: 'hr_transfer_cols',
    hr_attendance: 'hr_attendance_cols',
    mms_ledger: 'materials_table_cols',
    hr_user: 'hr_user_cols'
  }
  return map[moduleKey] || ''
}

const getStaticColumnsByModule = (moduleKey) => {
  const app = HR_APPS.find(item => item.aclModule === moduleKey)
  if (app?.staticColumns?.length) return app.staticColumns
  return BASE_STATIC_COLUMNS
}

const fetchConfigColumns = async (moduleKey) => {
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
  const moduleKey = fieldModule.value
  if (!moduleKey) {
    fieldLabelMap.value = {}
    return
  }
  const map = {}
  try {
    const res = await request({
      url: `/v_field_labels?module=eq.${moduleKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (Array.isArray(res)) {
      res.forEach((row) => {
        if (!row?.field_code) return
        const raw = row?.field_label || ''
        const code = row.field_code
        const normalized = String(raw).trim()
        const looksLikeCode = /^[a-z0-9_]+$/i.test(normalized)
        if (!normalized || normalized === '???' || normalized === '？？？' || looksLikeCode) {
          return
        }
        map[code] = normalized
      })
    }
  } catch (e) {
    console.warn('load field labels failed', e)
  }
  const fallbackLabels = FIELD_LABELS[moduleKey] || {}
  Object.keys(fallbackLabels).forEach((code) => {
    if (!map[code]) map[code] = fallbackLabels[code]
  })
  const configCols = await fetchConfigColumns(moduleKey)
  configCols.forEach((col) => {
    if (col?.prop && col?.label && !map[col.prop]) {
      map[col.prop] = col.label
    }
  })
  fieldLabelMap.value = map
}

const ensureFieldAclForModule = async (moduleKey) => {
  if (!moduleKey) return
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

watchEffect(() => {
  if (activeTab.value === 'field' && !fieldModule.value && modules.value.length) {
    fieldModule.value = modules.value[0]
  }
})

watchEffect(() => {
  if (activeTab.value === 'field') {
    ensureFieldAclForModule(fieldModule.value).then(() => {
      loadFieldLabelMap()
    })
  }
})

watch([fieldModule, fieldModuleGroup], async () => {
  if (activeTab.value === 'field') {
    await ensureFieldAclForModule(fieldModule.value)
    await loadFieldLabelMap()
    fieldGridRef.value?.loadData()
  }
})

watch(permModuleGroup, () => {
  const options = permAppOptions.value
  if (permApp.value && !matchesModuleGroup(permApp.value, permModuleGroup.value)) {
    permApp.value = ''
  }
  if (!permApp.value && options.length > 0) {
    permApp.value = options[0].value
  }
})

watch(fieldModuleGroup, () => {
  const options = fieldModuleOptions.value
  if (fieldModule.value && !matchesModuleGroup(fieldModule.value, fieldModuleGroup.value)) {
    fieldModule.value = ''
  }
  if (!fieldModule.value && options.length > 0) {
    fieldModule.value = options[0].value
  }
})

watch(scopeModuleGroup, () => {
  const options = scopeAppOptions.value
  if (scopeApp.value && !matchesModuleGroup(scopeApp.value, scopeModuleGroup.value)) {
    scopeApp.value = ''
  }
  if (!scopeApp.value && options.length > 0) {
    scopeApp.value = options[0].value
  }
})

watch([scopeModuleGroup, scopeApp], () => {
  if (activeTab.value === 'scope') scopeGridRef.value?.loadData()
})

watch([permModuleGroup, permApp], () => {
  if (activeTab.value === 'perm-app') permsAppGridRef.value?.loadData()
  if (activeTab.value === 'perm-op') permsOpGridRef.value?.loadData()
})

watch(activeTab, () => {
  if (activeTab.value === 'perm-module') permsModuleGridRef.value?.loadData()
  if (activeTab.value === 'perm-app') permsAppGridRef.value?.loadData()
  if (activeTab.value === 'perm-op') permsOpGridRef.value?.loadData()
})

watch(currentRoleId, () => {
  if (permsModuleGridRef.value?.loadData) permsModuleGridRef.value.loadData()
  if (permsAppGridRef.value?.loadData) permsAppGridRef.value.loadData()
  if (permsOpGridRef.value?.loadData) permsOpGridRef.value.loadData()
})

const handleCreate = async (type) => {
  try {
    if (type === 'roles') {
      const code = `role_${Date.now().toString().slice(-6)}`
      await request({
        url: '/roles',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { code, name: '新角色', description: '', sort: 100 }
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
          module: 'hr_employee',
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
