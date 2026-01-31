<template>
  <div class="label-preview">
    <div class="page-header">
      <el-button icon="ArrowLeft" @click="$router.back()">返回</el-button>
      <div class="header-actions">
        <el-button type="primary" plain @click="printLabel">打印标签</el-button>
      </div>
    </div>

    <div class="content" v-loading="loading">
      <section v-if="material" class="label-card">
        <div class="label-wrapper">
          <div class="qr-box" v-if="qrDataUrl">
            <img :src="qrDataUrl" alt="二维码" />
          </div>
          <div class="info-column">
            <div class="title">物料标签</div>
            <div v-for="item in infoPairs" :key="item.key" class="info-item">
              <span class="info-key">{{ item.key }}：</span>
              <span class="info-value">{{ item.value || '--' }}</span>
            </div>
            <div class="tips">打印提示：按 Ctrl + P 或使用浏览器菜单中的“打印”。</div>
          </div>
        </div>
      </section>
      <el-empty v-else description="暂无可打印的物料标签数据，请返回重试。" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import request from '@/utils/request'

const route = useRoute()
const loading = ref(false)
const material = ref(null)
const qrDataUrl = ref('')

const infoPairs = computed(() => {
  const row = material.value || {}
  const props = row.properties || {}
  return [
    { key: '物料编码', value: row.batch_no },
    { key: '物料名称', value: row.name },
    { key: '物料分类', value: row.category },
    { key: '规格', value: props.spec },
    { key: '单位', value: props.unit },
    { key: '计量单位', value: props.measure_unit },
    { key: '换算关系', value: props.conversion },
    { key: '入库日期', value: row.entry_date },
    { key: '创建人', value: row.created_by }
  ]
})

const buildQrContent = (row) => {
  if (!row) return ''
  return row.batch_no || row.name || String(row.id || '')
}

const loadMaterial = async () => {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const res = await request({
      url: `/raw_materials?id=eq.${id}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    material.value = Array.isArray(res) && res.length ? res[0] : null
  } finally {
    loading.value = false
  }
}

const renderQr = async () => {
  const row = material.value
  const text = buildQrContent(row)
  if (!text) {
    qrDataUrl.value = ''
    return
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(text, { width: 200, margin: 0 })
  } catch (e) {
    qrDataUrl.value = ''
  }
}

const printLabel = () => {
  window.print()
}

onMounted(async () => {
  await loadMaterial()
  await renderQr()
})

watch(() => route.params.id, async () => {
  await loadMaterial()
  await renderQr()
})
</script>

<style scoped lang="scss">
.label-preview {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.label-card {
  width: 100%;
  max-width: 780px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  padding: 24px 32px;
  box-sizing: border-box;
}

.label-wrapper {
  display: flex;
  gap: 24px;
  align-items: center;
}

.qr-box img {
  width: 200px;
  height: 200px;
}

.info-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 240px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.info-item {
  display: flex;
  font-size: 14px;
  color: #303133;
}

.info-key {
  width: 90px;
  font-weight: 600;
  color: #606266;
}

.info-value {
  flex: 1;
}

.tips {
  font-size: 12px;
  color: #909399;
}

@media print {
  .page-header {
    display: none;
  }
  .label-preview {
    padding: 0;
    background: #fff;
  }
  .label-card {
    border: none;
    box-shadow: none;
  }
  .tips {
    display: none;
  }
}
</style>
