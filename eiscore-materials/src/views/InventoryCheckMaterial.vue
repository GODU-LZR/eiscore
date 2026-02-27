<template>
  <div class="mat-detail">
    <div class="header-bar">
      <button class="back-btn" @click="goBack"><i class="back-icon" /> 返回</button>
      <h2>物料详情</h2>
      <span />
    </div>
    <div class="body">
      <div v-if="loading" class="state">加载物料信息中...</div>
      <div v-else-if="error" class="state error">{{ error }}</div>
      <template v-else>
        <!-- Hero -->
        <section class="hero-card">
          <div class="hero-main">
            <div class="title-row">
              <h2>{{ info.name || '物料信息' }}</h2>
              <span class="code">{{ info.batch_no || materialId }}</span>
            </div>
            <div class="tag-row">
              <span v-if="info.category" class="tag">{{ info.category }}</span>
              <span v-if="info.unit" class="tag outline">单位 {{ info.unit }}</span>
            </div>
            <div class="summary-grid">
              <div class="summary-item"><span>规格</span><strong>{{ fmtVal(info.specs) }}</strong></div>
              <div class="summary-item"><span>品牌</span><strong>{{ fmtVal(info.brand) }}</strong></div>
              <div class="summary-item"><span>安全库存</span><strong>{{ fmtVal(info.safety_stock) }}</strong></div>
              <div class="summary-item"><span>供应商</span><strong>{{ fmtVal(info.supplier_name) }}</strong></div>
            </div>
          </div>
        </section>

        <!-- 基础信息 -->
        <section class="detail-card">
          <h3>基础信息</h3>
          <div class="detail-grid">
            <div class="detail-item"><span class="label">物料编码</span><span class="value">{{ fmtVal(info.batch_no) }}</span></div>
            <div class="detail-item"><span class="label">物料名称</span><span class="value">{{ fmtVal(info.name) }}</span></div>
            <div class="detail-item"><span class="label">物料分类</span><span class="value">{{ fmtVal(info.category) }}</span></div>
            <div class="detail-item"><span class="label">单位</span><span class="value">{{ fmtVal(info.unit) }}</span></div>
            <div class="detail-item"><span class="label">规格</span><span class="value">{{ fmtVal(info.specs) }}</span></div>
            <div class="detail-item"><span class="label">品牌</span><span class="value">{{ fmtVal(info.brand) }}</span></div>
          </div>
        </section>

        <!-- 库存信息 -->
        <section class="detail-card">
          <h3>库存信息</h3>
          <div class="detail-grid">
            <div class="detail-item"><span class="label">安全库存</span><span class="value">{{ fmtVal(info.safety_stock) }}</span></div>
            <div class="detail-item"><span class="label">最低采购量</span><span class="value">{{ fmtVal(info.min_order) }}</span></div>
            <div class="detail-item"><span class="label">保质期(天)</span><span class="value">{{ fmtVal(info.shelf_life_days) }}</span></div>
            <div class="detail-item"><span class="label">供应商</span><span class="value">{{ fmtVal(info.supplier_name) }}</span></div>
          </div>
        </section>

        <!-- 其他 -->
        <section v-if="info.remark" class="detail-card">
          <h3>备注</h3>
          <p class="remark">{{ info.remark }}</p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMaterialById } from '@/api/check'

const route = useRoute()
const router = useRouter()
const materialId = ref(route.params.id || '')
const info = ref({})
const loading = ref(false)
const error = ref('')

onMounted(() => loadDetail())

async function loadDetail () {
  loading.value = true; error.value = ''
  try {
    const res = await fetchMaterialById(materialId.value)
    const mat = Array.isArray(res) && res.length ? res[0] : null
    if (!mat) { error.value = '未找到物料详情'; return }
    info.value = mat
  } catch { error.value = '加载物料详情失败' } finally { loading.value = false }
}

function goBack () { router.back() }
function fmtVal (v) { return v == null || v === '' ? '--' : v }
</script>

<style lang="scss" scoped>
.mat-detail {
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  min-height: 100vh; background: #f5f8f9;
}
.header-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.06);
  h2 { margin: 0; font-size: 16px; }
}
.back-btn {
  border: none; background: none; color: #1b6dff; font-size: 14px; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.back-icon {
  display: inline-block; width: 8px; height: 8px;
  border-left: 2px solid #1b6dff; border-bottom: 2px solid #1b6dff; transform: rotate(45deg);
}
.body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.hero-card {
  background: #fff; border-radius: 16px; padding: 18px; box-shadow: 0 12px 28px rgba(20,37,90,.1);
}
.title-row { display: flex; justify-content: space-between; align-items: center; }
.title-row h2 { margin: 0; font-size: 20px; }
.code { font-family: Consolas, monospace; color: #5a6b7c; font-size: 13px; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.tag {
  padding: 4px 10px; border-radius: 999px; font-size: 12px;
  background: #e9f2ff; color: #1e6fff;
}
.tag.outline { background: transparent; border: 1px solid #d7dde6; color: #5a6b7c; }
.summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 14px; }
.summary-item {
  display: flex; flex-direction: column; gap: 2px;
  span { font-size: 12px; color: #8a97a6; }
  strong { font-size: 14px; color: #1f2d3d; }
}
.detail-card {
  background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 6px 16px rgba(27,46,94,.06);
  h3 { margin: 0 0 12px; font-size: 16px; }
}
.detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.detail-item { display: flex; flex-direction: column; }
.detail-item .label { font-size: 12px; color: #8a97a6; }
.detail-item .value { margin-top: 4px; font-size: 14px; color: #1f2d3d; }
.remark { margin: 0; font-size: 14px; color: #5a6b7c; line-height: 1.6; }
.state { text-align: center; padding: 40px; color: #8a97a6; &.error { color: #ff4d4f; } }
</style>
