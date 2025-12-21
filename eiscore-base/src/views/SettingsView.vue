<template>
  <div class="settings-container">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>⚙️ 全局系统设置</span>
        </div>
      </template>

      <el-form :model="form" label-width="120px" size="large">
        <el-divider content-position="left">基础信息</el-divider>
        
        <el-form-item label="系统名称">
          <el-input v-model="form.title" placeholder="请输入系统显示的名称" @input="updateConfig">
            <template #prefix><el-icon><Monitor /></el-icon></template>
          </el-input>
          <div class="tips">修改后，左侧菜单栏和浏览器标题将实时更新。</div>
        </el-form-item>

        <el-form-item label="系统 Logo">
          <el-upload
            class="avatar-uploader"
            action="#"
            :show-file-list="false"
            :auto-upload="false"
            disabled
          >
            <img v-if="form.logo" :src="form.logo" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
          </el-upload>
          <div class="tips">（演示环境暂不支持真实上传，仅展示效果）</div>
        </el-form-item>

        <el-divider content-position="left">个性化 / 主题</el-divider>

        <el-form-item label="主题色">
          <el-color-picker v-model="form.themeColor" @change="updateConfig" />
          <span style="margin-left: 10px; color: #909399;">当前: {{ form.themeColor }}</span>
        </el-form-item>

        <el-form-item label="紧凑模式">
           <el-switch v-model="form.isCompact" active-text="开启" inactive-text="关闭" />
           <div class="tips">开启后将减小表格和列表的间距，适合展示大量数据。</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存配置</el-button>
          <el-button @click="resetSettings">重置默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { useSystemStore } from '@/stores/system'
import { ElMessage } from 'element-plus'

const systemStore = useSystemStore()

// 表单数据初始化为 Store 里的数据
const form = reactive({ ...systemStore.config })

// 实时预览：当输入框变化时，立即同步到 Store，让 Layout 产生变化
const updateConfig = () => {
  systemStore.setSystemConfig({
    title: form.title,
    themeColor: form.themeColor
  })
}

const saveSettings = () => {
  // 这里未来会调用后端 API： axios.post('/api/settings', form)
  ElMessage.success('系统配置已保存！')
}

const resetSettings = () => {
  form.title = '企业数字化平台'
  form.themeColor = '#409EFF'
  updateConfig()
  ElMessage.info('已恢复默认设置')
}
</script>

<style scoped>
.settings-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.tips {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 5px;
}
.avatar-uploader {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 100px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.avatar { width: 80px; height: 80px; object-fit: contain; }
</style>