<template>
  <div style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统全局设置</span>
        </div>
      </template>
      
      <el-alert
        v-if="!canManage"
        title="仅超级管理员可修改系统设置"
        type="warning"
        show-icon
        style="margin-bottom: 16px;"
      />

      <el-form label-width="120px" style="max-width: 600px" :disabled="!canManage">
        <el-form-item label="系统标题">
          <el-input v-model="form.title" placeholder="请输入左上角显示的标题" />
        </el-form-item>
        
        <el-form-item label="主题颜色">
          <div style="display: flex; align-items: center; gap: 15px;">
            <el-color-picker v-model="form.themeColor" />
            
            <div class="preset-colors">
              <div 
                v-for="color in predefineColors" 
                :key="color"
                class="color-block"
                :style="{ backgroundColor: color }"
                @click="form.themeColor = color"
              ></div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="开启通知">
          <el-switch v-model="form.notifications" />
        </el-form-item>

        <el-form-item label="物料分类层级">
          <el-radio-group v-model="form.materialsCategoryDepth">
            <el-radio :label="2">二级</el-radio>
            <el-radio :label="3">三级</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="canManage">
          <el-button type="primary" @click="saveSettings">保存并生效</el-button>
          <el-button @click="resetSettings">重置默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed, watch } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const systemStore = useSystemStore()
const userStore = useUserStore()

// 预设一些好看的颜色
const predefineColors = [
  '#409EFF', // 默认蓝
  '#F5222D', // 热情红
  '#FAAD14', // 活力橙
  '#52C41A', // 清新绿
  '#13C2C2', // 极简青
  '#722ED1', // 优雅紫
  '#EB2F96', // 魅惑粉
]

const form = reactive({
  title: '',
  themeColor: '#409EFF',
  notifications: true,
  materialsCategoryDepth: 2
})

const canManage = computed(() => {
  const role = String(userStore.userInfo?.role || '').toLowerCase()
  const dbRole = String(userStore.userInfo?.dbRole || '').toLowerCase()
  const username = String(userStore.userInfo?.username || '').toLowerCase()
  return role === 'super_admin'
    || role === 'admin'
    || role === '超级管理员'
    || dbRole === 'super_admin'
    || dbRole === 'admin'
    || username === 'admin'
})

// 进入页面时，读取 Store 里的当前值
onMounted(() => {
  if (systemStore.config) {
    form.title = systemStore.config.title || '海边姑娘管理系统'
    form.themeColor = systemStore.config.themeColor || '#409EFF'
    form.notifications = systemStore.config.notifications !== false
    form.materialsCategoryDepth =
      systemStore.config.materialsCategoryDepth === 3 ? 3 : 2
  }
})

watch(() => systemStore.config, (val) => {
  if (!val) return
  form.title = val.title || '海边姑娘管理系统'
  form.themeColor = val.themeColor || '#409EFF'
  form.notifications = val.notifications !== false
  form.materialsCategoryDepth = val.materialsCategoryDepth === 3 ? 3 : 2
}, { deep: true })

const saveSettings = async () => {
  if (!canManage.value) return
  const ok = await systemStore.saveConfig({ 
    title: form.title,
    themeColor: form.themeColor,
    notifications: form.notifications,
    materialsCategoryDepth: form.materialsCategoryDepth === 3 ? 3 : 2
  })
  if (ok) ElMessage.success('设置已保存，主题色已更新！')
  else ElMessage.error('保存失败，请稍后重试')
}

const resetSettings = () => {
  form.themeColor = '#409EFF'
  form.title = '海边姑娘管理系统'
  form.notifications = true
  saveSettings()
}
</script>

<style scoped lang="scss">
.preset-colors {
  display: flex;
  gap: 8px;
  
  .color-block {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid #ddd;
    transition: transform 0.2s;
    
    &:hover {
      transform: scale(1.2);
    }
  }
}
</style>
