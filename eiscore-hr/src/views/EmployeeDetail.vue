<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button icon="ArrowLeft" @click="$router.back()">返回列表</el-button>
      <h2 style="margin-left: 20px; display: inline-block;">员工详情表单 (ID: {{ id }})</h2>
    </div>
    
    <div class="form-container">
      <el-alert title="AI 表单渲染引擎将在此处加载" type="success" :closable="false" style="margin-bottom: 15px;" />
      
      <div class="debug-view">
        <h3>当前数据：</h3>
        <pre>{{ formData }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import request from '@/utils/request'

const route = useRoute()
const props = defineProps(['id'])
const formData = ref({})

onMounted(async () => {
  // 根据 ID 加载详情数据
  if (props.id) {
    try {
      const res = await request({ 
        url: `/archives?id=eq.${props.id}`, 
        method: 'get',
        headers: { 'Accept-Profile': 'hr' }
      })
      if (res && res.length > 0) {
        formData.value = res[0]
      }
    } catch (e) {
      console.error(e)
    }
  }
})
</script>

<style scoped>
.detail-page { padding: 20px; background: #fff; height: 100%; display: flex; flex-direction: column; }
.page-header { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; display: flex; align-items: center; }
.form-container { flex: 1; padding: 20px; border: 1px solid #dcdfe6; border-radius: 4px; overflow-y: auto; }
.debug-view { background: #f5f7fa; padding: 15px; border-radius: 4px; font-family: monospace; }
</style>