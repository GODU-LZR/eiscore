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
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { hasPerm } from '@/utils/permission'

const router = useRouter()
const gridRef = ref(null)
const roleOptions = ref([])

const columns = computed(() => ([
  { label: '用户名', prop: 'username', width: 140 },
  { label: '姓名', prop: 'full_name', width: 140 },
  { label: '手机号', prop: 'phone', width: 140 },
  { label: '邮箱', prop: 'email', width: 180 },
  { label: '角色', prop: 'role_id', width: 160, type: 'select', options: roleOptions.value },
  { label: '状态', prop: 'status', width: 120, type: 'select', options: [
    { label: '启用', value: 'active' },
    { label: '停用', value: 'disabled' }
  ] }
]))

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

const syncFieldAcl = async () => {
  const fieldCodes = ['username', 'full_name', 'phone', 'email', 'role_id', 'status']
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

onMounted(async () => {
  await loadRoles()
  await syncFieldAcl()
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
</style>
