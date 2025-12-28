<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button icon="ArrowLeft" @click="$router.back()">返回列表</el-button>
      <div class="header-actions">
        <el-button type="primary" plain @click="printDoc">打印单据</el-button>
        <el-button type="success" @click="saveDoc">保存修改</el-button>
      </div>
    </div>
    
    <div class="form-container" v-loading="loading">
      <EisDocumentEngine 
        v-if="formData && schema"
        v-model="formData" 
        :schema="schema" 
      />
      <el-empty v-else description="正在加载数据或配置..." />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

// 🟢 引入渲染引擎和 Schema 示例
import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'
import { documentSchemaExample } from '@/components/eis-document-engine/documentSchemaExample'

const route = useRoute()
const router = useRouter()
const props = defineProps(['id'])

const loading = ref(false)
const formData = ref(null)
// 这里暂时使用硬编码的 Schema，后续可以从 sys_grid_configs 表里加载
const schema = ref(documentSchemaExample)

const loadData = async () => {
  if (!props.id) return
  loading.value = true
  try {
    const res = await request({ 
      url: `/archives?id=eq.${props.id}`, 
      method: 'get',
      headers: { 'Accept-Profile': 'hr' }
    })
    if (res && res.length > 0) {
      formData.value = res[0]
      // 模拟一些子表数据用于展示效果 (因为数据库里可能还没有 work_history)
      if (!formData.value.properties) formData.value.properties = {}
      if (!formData.value.properties.work_history) {
        formData.value.properties.work_history = [
          { company: '示例前司A', position: '初级工', start_date: '2020-01-01', end_date: '2021-01-01' },
          { company: '示例前司B', position: '组长', start_date: '2021-02-01', end_date: '2023-01-01' }
        ]
      }
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

const saveDoc = async () => {
  if (!formData.value) return
  try {
    await request({
      url: `/archives?id=eq.${props.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'hr' },
      data: {
        // 只更新允许更新的字段
        name: formData.value.name,
        properties: formData.value.properties
      }
    })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const printDoc = () => {
  window.print()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.detail-page { 
  padding: 20px; 
  background: #f0f2f5; 
  height: 100vh; 
  display: flex; 
  flex-direction: column; 
  box-sizing: border-box;
}

.page-header { 
  margin-bottom: 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  background: #fff;
  padding: 15px 20px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.form-container { 
  flex: 1; 
  overflow-y: auto; 
  display: flex;
  justify-content: center; /* 居中显示纸张 */
  padding-bottom: 40px;
}

/* 打印时的样式优化 */
@media print {
  .detail-page { background: white; padding: 0; height: auto; }
  .page-header { display: none; }
  .form-container { overflow: visible; padding: 0; }
}
</style>