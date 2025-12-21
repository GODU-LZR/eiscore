<template>
  <div style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统全局设置</span>
        </div>
      </template>
      
      <el-form label-width="120px" style="max-width: 600px">
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
        
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存并生效</el-button>
          <el-button @click="resetSettings">重置默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { ElMessage } from 'element-plus'

const systemStore = useSystemStore()

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
  notifications: true
})

// 进入页面时，读取 Store 里的当前值
onMounted(() => {
  if (systemStore.config) {
    form.title = systemStore.config.title || '海边姑娘管理系统'
    form.themeColor = systemStore.config.themeColor || '#409EFF'
  }
})

const saveSettings = () => {
  systemStore.updateConfig({ 
    title: form.title,
    themeColor: form.themeColor
  })
  ElMessage.success('设置已保存，主题色已更新！')
}

const resetSettings = () => {
  form.themeColor = '#409EFF'
  form.title = '海边姑娘管理系统'
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