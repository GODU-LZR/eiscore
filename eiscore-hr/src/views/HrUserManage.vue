<template>
  <div class="user-manage">
    <div class="header">
      <div class="header-text">
        <h2>用户管理</h2>
        <p>系统用户的增删改查与角色绑定</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <el-card shadow="never" class="grid-card" :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }">
      <eis-data-grid
        ref="gridRef"
        view-id="hr_user_manage"
        api-url="/v_users_manage?order=id.asc"
        write-url="/v_users_manage"
        write-mode="patch"
        :patch-required-fields="['id']"
        :static-columns="columns"
        :include-properties="false"
        accept-profile="public"
        content-profile="public"
        :show-action-col="false"
        :auto-size-columns="false"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-delete="canDelete"
        :can-export="canExport"
        :can-config="canConfig"
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @cell-value-changed="handleCellChanged"
      />
    </el-card>

    <el-dialog v-model="colConfigVisible" title="列管理" width="520px" append-to-body destroy-on-close>
      <div class="column-manager">
        <p class="section-title">固定列显示：</p>
        <div class="col-list">
          <div v-for="col in staticColumnsAll" :key="col.prop" class="col-item">
            <div class="col-info">
              <span class="col-label">{{ col.label }}</span>
            </div>
            <div class="col-actions">
              <el-switch
                :model-value="isStaticVisible(col.prop)"
                active-text="显示"
                inactive-text="隐藏"
                @change="toggleStaticColumn(col.prop, $event)"
              />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="colConfigVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { hasPerm } from '@/utils/permission'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const gridRef = ref(null)
const roleOptions = ref([])
const deptOptions = ref([])
const userStore = useUserStore()

const colConfigVisible = ref(false)
const staticHidden = ref([])

const staticColumnsAll = computed(() => ([
  { label: '用户名', prop: 'username', width: 140 },
  { label: '登录密码', prop: 'password', width: 140, valueFormatter: (params) => (params.value ? '******' : '') },
  { label: '姓名', prop: 'full_name', width: 140 },
  { label: '手机号', prop: 'phone', width: 140 },
  { label: '邮箱', prop: 'email', width: 180 },
  { label: '部门', prop: 'dept_id', width: 160, type: 'select', options: deptOptions.value },
  { label: '头像', prop: 'avatar', width: 120, type: 'file', fileMaxCount: 1, fileMaxSizeMb: 2, fileAccept: 'image/*', fileStoreMode: 'url' },
  { label: '角色', prop: 'role_id', width: 160, type: 'select', options: roleOptions.value }
]))

const columns = computed(() =>
  staticColumnsAll.value.filter(col => !staticHidden.value.includes(col.prop))
)

const opPerms = {
  create: 'op:hr_user.create',
  edit: 'op:hr_user.edit',
  delete: 'op:hr_user.delete',
  export: 'op:hr_user.export',
  config: 'op:hr_user.config'
}

const canCreate = computed(() => hasPerm(opPerms.create))
const canEdit = computed(() => hasPerm(opPerms.edit))
const canDelete = computed(() => hasPerm(opPerms.delete))
const canExport = computed(() => hasPerm(opPerms.export))
const canConfig = computed(() => hasPerm(opPerms.config))

const goApps = () => {
  router.push('/apps')
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const loadStaticColumnsConfig = async () => {
  const configKey = 'hr_user_manage_static_hidden'
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const hidden = Array.isArray(res) && res.length ? res[0].value : []
    const props = new Set(staticColumnsAll.value.map(col => col.prop).filter(Boolean))
    staticHidden.value = Array.isArray(hidden)
      ? hidden.filter(prop => props.has(prop))
      : []
  } catch (e) {
    staticHidden.value = []
  }
}

const saveStaticColumnsConfig = async () => {
  const configKey = 'hr_user_manage_static_hidden'
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: staticHidden.value }
  })
}

const isStaticVisible = (prop) => !staticHidden.value.includes(prop)
const toggleStaticColumn = async (prop, visible) => {
  const has = staticHidden.value.includes(prop)
  if (visible && has) {
    staticHidden.value = staticHidden.value.filter(item => item !== prop)
  }
  if (!visible && !has) {
    staticHidden.value = [...staticHidden.value, prop]
  }
  await saveStaticColumnsConfig()
}

const loadRoles = async () => {
  try {
    const res = await request({
      url: '/roles?order=sort.asc',
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    roleOptions.value = Array.isArray(res)
      ? res.map((r) => ({ label: r.name || r.code, value: r.id }))
      : []
  } catch (e) {
    console.error(e)
  }
}

const loadDepartments = async () => {
  try {
    const res = await request({
      url: '/departments?order=sort.asc,name.asc',
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    deptOptions.value = Array.isArray(res)
      ? res.map((d) => ({ label: d.name, value: d.id }))
      : []
  } catch (e) {
    deptOptions.value = []
  }
}

const handleCreate = async () => {
  try {
    const suffix = Date.now().toString().slice(-6)
    const defaultRole = roleOptions.value[0]?.value || null
    const userRes = await request({
      url: '/users',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: {
        username: `user_${suffix}`,
        password: '123456',
        full_name: '新用户',
        status: 'active'
      }
    })
    const newUser = Array.isArray(userRes) ? userRes[0] : userRes
    if (newUser?.id && defaultRole) {
      await request({
        url: '/user_roles',
        method: 'post',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'resolution=merge-duplicates' },
        data: { user_id: newUser.id, role_id: defaultRole }
      })
    }
    gridRef.value?.loadData()
    ElMessage.success('已创建新用户')
  } catch (e) {
    console.error(e)
    ElMessage.error('创建失败')
  }
}

const resolveAvatarValue = async (value) => {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('data:') || value.startsWith('http')) return value
  if (!value.startsWith('file:')) return value
  const fileId = value.replace('file:', '')
  if (!fileId) return ''
  try {
    const res = await request({
      url: `/files?id=eq.${fileId}&select=content_base64,mime_type`,
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    const row = Array.isArray(res) ? res[0] : null
    if (!row?.content_base64) return ''
    const mime = row.mime_type || 'application/octet-stream'
    return `data:${mime};base64,${row.content_base64}`
  } catch (e) {
    return ''
  }
}

const handleCellChanged = async (event) => {
  if (!event?.data) return
  if (event.colDef?.field !== 'avatar') return
  const current = userStore.userInfo?.username
  if (!current || event.data.username !== current) return
  const hasNewValue = Object.prototype.hasOwnProperty.call(event, 'newValue')
  const raw = hasNewValue ? event.newValue : (event.data.avatar ?? '')
  let newAvatar = raw
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      newAvatar = ''
    } else {
      const first = raw[0]
      newAvatar = first?.url || first?.dataUrl || first?.name || ''
    }
  } else if (raw && typeof raw === 'object') {
    newAvatar = raw.url || raw.dataUrl || raw.name || ''
  }
  if (typeof newAvatar === 'string' && newAvatar.startsWith('file:')) {
    newAvatar = await resolveAvatarValue(newAvatar)
  }
  const stored = localStorage.getItem('user_info')
  if (!stored) return
  try {
    const info = JSON.parse(stored)
    info.avatar = newAvatar || ''
    localStorage.setItem('user_info', JSON.stringify(info))
    userStore.userInfo = info
    // 通知基座 & 其他子应用刷新用户头像（多通道保障）
    const payload = { type: 'user-info-updated', user_info: info, user: info }
    // 本窗口
    const fire = (t) => { try { t?.dispatchEvent?.(new CustomEvent('user-info-updated')) } catch (_) {} }
    fire(window)
    fire(document)
    if (window.parent && window.parent !== window) fire(window.parent)
    if (window.top && window.top !== window && window.top !== window.parent) fire(window.top)
    ;[window, window.parent, window.top].forEach((t) => {
      try { t?.postMessage?.(payload, '*') } catch (_) {}
    })
    // 额外触发 storage 事件，保证基座监听 storage 时也能收到
    const storageEventInit = { key: 'user_info', newValue: JSON.stringify(info), storageArea: localStorage }
    try { window.dispatchEvent(new StorageEvent('storage', storageEventInit)) } catch (_) {}
    if (window.parent && window.parent !== window) {
      try { window.parent.dispatchEvent(new StorageEvent('storage', storageEventInit)) } catch (_) {}
    }
    if (window.top && window.top !== window && window.top !== window.parent) {
      try { window.top.dispatchEvent(new StorageEvent('storage', storageEventInit)) } catch (_) {}
    }
    if (window.__EIS_BASE_ACTIONS__?.setGlobalState) {
      console.info('[HR] setGlobalState user-info-updated')
      window.__EIS_BASE_ACTIONS__.setGlobalState({ user_info: info, user: info })
    }
  } catch (e) {
    console.warn('update user_info avatar failed', e)
  }
}

const syncFieldAcl = async () => {
  const fieldCodes = ['username', 'password', 'full_name', 'phone', 'email', 'dept_id', 'avatar', 'role_id']
  try {
    await request({
      url: '/rpc/ensure_field_acl',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { module_name: 'hr_user', field_codes: fieldCodes }
    })
  } catch (e) {
    console.warn('sync field acl failed', e)
  }
}

const syncFieldLabels = async () => {
  const payload = staticColumnsAll.value
    .filter(col => col?.prop && col?.label)
    .map(col => ({
      module: 'hr_user',
      field_code: col.prop,
      field_label: col.label
    }))
  if (payload.length === 0) return
  try {
    await request({
      url: '/field_label_overrides',
      method: 'post',
      headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: payload
    })
  } catch (e) {
    console.warn('sync field labels failed', e)
  }
}

onMounted(async () => {
  await loadRoles()
  await loadDepartments()
  await loadStaticColumnsConfig()
})
</script>

<style scoped>
.user-manage {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.grid-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.column-manager { padding: 0 5px; }
.section-title { font-weight: bold; margin-bottom: 10px; color: #303133; font-size: 14px; }
.col-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  padding: 5px;
  border-radius: 4px;
  background-color: #fafafa;
}
.col-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  background-color: #fff;
}
.col-item:last-child { border-bottom: none; }
.col-info { display: flex; align-items: center; }
.col-label { font-size: 13px; font-weight: 500; }
.col-actions { display: flex; align-items: center; }
</style>
