<template>
  <div class="acl-view">
    <div class="header">
      <div class="title">角色与权限管理</div>
      <el-select v-model="currentRoleId" placeholder="选择角色" style="width: 240px" @change="refreshRoleScoped">
        <el-option v-for="r in roles" :key="r.id" :label="roleLabel(r)" :value="r.id" />
      </el-select>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane label="角色列表" name="roles">
        <div class="grid-wrap">
          <eis-data-grid
            ref="rolesGridRef"
            view-id="hr_acl_roles"
            api-url="/roles?order=sort.asc"
            write-url="/roles"
            :include-properties="false"
            :static-columns="roleColumns"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            default-order=""
            @create="handleCreate('roles')"
            @config-columns="handleConfigColumns"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="权限点" name="permissions">
        <div class="grid-wrap">
          <eis-data-grid
            ref="permsGridRef"
            view-id="hr_acl_permissions"
            api-url="/permissions?order=module.asc,action.asc"
            write-url="/permissions"
            :include-properties="false"
            :static-columns="permColumns"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            default-order=""
            @create="handleCreate('permissions')"
            @config-columns="handleConfigColumns"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="数据范围" name="scope">
        <div class="grid-wrap">
          <eis-data-grid
            ref="scopeGridRef"
            view-id="hr_acl_scopes"
            :api-url="scopeApiUrl"
            write-url="/role_data_scopes"
            :include-properties="false"
            :static-columns="scopeColumns"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            default-order=""
            @create="handleCreate('scopes')"
            @config-columns="handleConfigColumns"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="字段权限" name="field">
        <div class="table-toolbar">
          <el-select v-model="fieldModule" placeholder="选择模块" style="width: 220px" @change="refreshRoleScoped">
            <el-option v-for="m in modules" :key="m" :label="moduleLabel(m)" :value="m" />
          </el-select>
        </div>
        <div class="grid-wrap">
          <eis-data-grid
            ref="fieldGridRef"
            view-id="hr_acl_fields"
            :api-url="fieldApiUrl"
            write-url="/sys_field_acl"
            :include-properties="false"
            :static-columns="fieldColumns"
            :extra-columns="[]"
            :summary="emptySummary"
            accept-profile="public"
            content-profile="public"
            :show-action-col="false"
            default-order=""
            @create="handleCreate('fields')"
            @config-columns="handleConfigColumns"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '@/utils/request'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import { ElMessage } from 'element-plus'

const roles = ref([])
const modules = ref(['hr_employee', 'hr_org', 'hr_attendance', 'hr_change', 'hr_acl', 'mms_ledger'])

const currentRoleId = ref('')
const fieldModule = ref('')
const activeTab = ref('roles')
const rolesGridRef = ref(null)
const permsGridRef = ref(null)
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

const parsePermissionCode = (code) => {
  if (!code || typeof code !== 'string') return null
  const parts = code.split(':')
  if (parts.length < 2) return null
  const prefix = parts[0]
  const detail = parts.slice(1).join(':')
  if (prefix === 'module') return { type: 'module', key: detail }
  if (prefix === 'app') return { type: 'app', key: detail }
  if (prefix === 'op') {
    const [appKey, actionKey] = detail.split('.')
    return { type: 'op', appKey, actionKey }
  }
  const [moduleKey, actionKey] = detail.split('.')
  return { type: 'legacy', moduleKey, actionKey }
}

const permissionNameFromCode = (code, fallback) => {
  const parsed = parsePermissionCode(code)
  if (!parsed) return fallback || code
  const moduleMap = {
    hr: '人事',
    mms: '物料',
    home: '首页',
    hr_employee: '人事花名册',
    hr_org: '部门架构',
    hr_attendance: '考勤管理',
    hr_change: '调岗记录',
    hr_acl: '权限管理',
    mms_ledger: '物料台账',
    employee: '花名册',
    org: '组织架构',
    change: '调岗',
    attendance: '考勤',
    payroll: '薪酬',
    profile: '档案',
    acl: '权限'
  }
  if (parsed.type === 'module') return `模块-${moduleMap[parsed.key] || parsed.key}`
  if (parsed.type === 'app') return `应用-${moduleMap[parsed.key] || parsed.key}`
  if (parsed.type === 'op') {
    const appName = moduleMap[parsed.appKey] || parsed.appKey
    return `${appName}-${actionLabel(parsed.actionKey || '')}`
  }
  const moduleName = moduleMap[parsed.moduleKey] || parsed.moduleKey
  const actionName = actionLabel(parsed.actionKey)
  return `${moduleName}-${actionName}`
}

const roleLabel = (r) => {
  const name = roleNameMap[r.code] || r.name || r.code
  return `${name}（${r.code}）`
}

const roleColumns = [
  { prop: 'code', label: '角色编码', editable: true },
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
]

const permColumns = [
  { prop: 'module', label: '分类/模块', width: 160, editable: true, type: 'select', options: [
    { label: '模块', value: '模块' },
    { label: '应用', value: '应用' },
    { label: '人事花名册', value: '人事花名册' },
    { label: '部门架构', value: '部门架构' },
    { label: '考勤管理', value: '考勤管理' },
    { label: '调岗记录', value: '调岗记录' },
    { label: '权限管理', value: '权限管理' },
    { label: '物料台账', value: '物料台账' }
  ] },
  { prop: 'action', label: '动作', width: 140, editable: true, type: 'select', options: [
    { label: '显示', value: '显示' },
    { label: '进入', value: '进入' },
    { label: '查看', value: '查看' },
    { label: '新增', value: '新增' },
    { label: '编辑', value: '编辑' },
    { label: '删除', value: '删除' },
    { label: '导出', value: '导出' },
    { label: '配置', value: '配置' },
    { label: '保存布局', value: '保存布局' },
    { label: '班次管理', value: '班次管理' },
    { label: '班次新增', value: '班次新增' },
    { label: '成员管理', value: '成员管理' }
  ] },
  { prop: 'code', label: '权限码', editable: true, width: 240 },
  {
    prop: 'name',
    label: '名称',
    editable: true,
    valueFormatter: (params) => permissionNameFromCode(params.data?.code, params.value)
  }
]

const scopeColumns = [
  { prop: 'role_id', label: '角色ID', editable: false, width: 220 },
  { prop: 'module', label: '模块', width: 160, editable: true, type: 'select', options: modules.value.map(m => ({ label: moduleLabel(m), value: m })) },
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
  { prop: 'module', label: '模块', width: 160, editable: true, type: 'select', options: modules.value.map(m => ({ label: moduleLabel(m), value: m })) },
  { prop: 'field_code', label: '字段', width: 200, editable: true },
  { prop: 'can_view', label: '可见', editable: true, type: 'select', options: [
    { label: '是', value: true },
    { label: '否', value: false }
  ]},
  { prop: 'can_edit', label: '可编辑', editable: true, type: 'select', options: [
    { label: '是', value: true },
    { label: '否', value: false }
  ]}
]

const loadRoles = async () => {
  const res = await request({ url: '/roles?order=sort.asc', method: 'get', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' } })
  roles.value = Array.isArray(res) ? res : []
  if (!currentRoleId.value && roles.value.length) currentRoleId.value = roles.value[0].id
}

const scopeApiUrl = computed(() => {
  if (!currentRoleId.value) return '/role_data_scopes?order=module.asc'
  return `/role_data_scopes?role_id=eq.${currentRoleId.value}&order=module.asc`
})

const fieldApiUrl = computed(() => {
  if (!currentRoleId.value || !fieldModule.value) return '/sys_field_acl?order=module.asc,field_code.asc'
  return `/sys_field_acl?role_id=eq.${currentRoleId.value}&module=eq.${fieldModule.value}&order=field_code.asc`
})

const refreshRoleScoped = async () => {
  if (rolesGridRef.value?.loadData) rolesGridRef.value.loadData()
  if (permsGridRef.value?.loadData) permsGridRef.value.loadData()
  if (scopeGridRef.value?.loadData) scopeGridRef.value.loadData()
  if (fieldGridRef.value?.loadData) fieldGridRef.value.loadData()
}

const handleConfigColumns = () => {
  ElMessage.info('权限管理暂不支持自定义列')
}

const handleCreate = async (type) => {
  try {
    if (type === 'roles') {
      const code = `role_${Date.now().toString().slice(-6)}`
      await request({
        url: '/roles',
        method: 'post',
        headers: { 'Content-Profile': 'public' },
        data: { code, name: '新角色', description: '', sort: 100 }
      })
      rolesGridRef.value?.loadData()
      await loadRoles()
      ElMessage.success('已新增角色')
      return
    }

    if (type === 'permissions') {
      const suffix = Date.now().toString().slice(-6)
      await request({
        url: '/permissions',
        method: 'post',
        headers: { 'Content-Profile': 'public' },
        data: {
          module: '人事花名册',
          action: '自定义',
          code: `op:hr_employee.custom_${suffix}`,
          name: '人事花名册-自定义'
        }
      })
      permsGridRef.value?.loadData()
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
        headers: { 'Content-Profile': 'public' },
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
        headers: { 'Content-Profile': 'public' },
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
.hint {
  color: #909399;
  font-size: 12px;
}
</style>
