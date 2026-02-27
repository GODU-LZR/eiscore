<template>
  <div class="material-detail">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>物料详情</p>
      <span />
    </div>

    <div class="content">
      <!-- 加载态 -->
      <div v-if="loading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">正在加载物料详情...</div>
      </div>

      <!-- 错误态 -->
      <div v-if="errorMsg" class="state error">{{ errorMsg }}</div>

      <!-- Hero 卡片 -->
      <section v-if="material" class="hero-card">
        <div class="title-row">
          <h2>{{ material.name || '未命名物料' }}</h2>
        </div>
        <div class="tag-row">
          <span v-if="material.category" class="tag">{{ material.category }}</span>
          <span v-if="material.brand" class="tag brand">{{ material.brand }}</span>
          <span v-if="material.unit" class="tag unit">{{ material.unit }}</span>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">物料编码</span>
            <span class="summary-value mono">{{ material.code || '--' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">批次号</span>
            <span class="summary-value mono">{{ material.batch_no || '--' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">可用库存</span>
            <span class="summary-value highlight">{{ fmtQty(material.available_qty) }} {{ material.unit || '' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">安全库存</span>
            <span class="summary-value">{{ fmtQty(material.safety_stock) }} {{ material.unit || '' }}</span>
          </div>
        </div>
      </section>

      <!-- 基础信息 -->
      <section v-if="material" class="detail-card">
        <div class="card-title">基础信息</div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">物料名称</span>
            <span class="detail-value">{{ material.name || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">物料编码</span>
            <span class="detail-value mono">{{ material.code || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">物料分类</span>
            <span class="detail-value">{{ material.category || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">品牌</span>
            <span class="detail-value">{{ material.brand || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">供应商</span>
            <span class="detail-value">{{ material.supplier_name || '--' }}</span>
          </div>
        </div>
      </section>

      <!-- 规格与计量 -->
      <section v-if="material" class="detail-card">
        <div class="card-title">规格与计量</div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">计量单位</span>
            <span class="detail-value">{{ material.unit || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">规格型号</span>
            <span class="detail-value">{{ material.specs || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">安全库存</span>
            <span class="detail-value">{{ fmtQty(material.safety_stock) }}</span>
          </div>
        </div>
      </section>

      <!-- 管理信息 -->
      <section v-if="material" class="detail-card">
        <div class="card-title">管理信息</div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">批次编号</span>
            <span class="detail-value mono">{{ material.batch_no || '--' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">当前可用</span>
            <span class="detail-value highlight">{{ fmtQty(material.available_qty) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态</span>
            <span class="detail-value status-ok">{{ material.status || '正常' }}</span>
          </div>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { fetchMaterialById, fetchInventoryByLocation } from '@/api/check'
import { getCheckCache, getColdMode } from '@/utils/check-cache'

const route = useRoute()
const materialId = computed(() => route.params.id)
const material = ref(null)
const loading = ref(false)
const errorMsg = ref('')

onMounted(() => loadMaterial())

async function loadMaterial() {
  loading.value = true
  errorMsg.value = ''
  try {
    // 冷库缓存优先
    if (getColdMode()) {
      const cache = getCheckCache()
      if (cache) {
        for (const wh of (cache.warehouses || [])) {
          for (const loc of (wh.locations || [])) {
            const m = (loc.materials || []).find(i => String(i.material_id) === String(materialId.value))
            if (m) {
              material.value = {
                id: m.material_id,
                name: m.material_name,
                code: m.material_code,
                batch_no: m.batch_no,
                unit: m.unit,
                available_qty: m.available_qty,
                category: '',
                brand: '',
                specs: '',
                safety_stock: null,
                supplier_name: '',
                status: '正常'
              }
              loading.value = false
              return
            }
          }
        }
      }
    }

    // 在线查详情
    const list = await fetchMaterialById(materialId.value)
    if (!list || !list.length) {
      errorMsg.value = '未找到该物料'
      return
    }
    const raw = list[0]
    material.value = {
      id: raw.id,
      name: raw.name || '--',
      code: raw.code || '--',
      batch_no: raw.batch_no || '',
      unit: raw.unit || '',
      available_qty: raw.available_qty ?? null,
      category: raw.category || '',
      brand: raw.brand || '',
      specs: raw.specs || '',
      safety_stock: raw.safety_stock ?? null,
      supplier_name: raw.supplier_name || '',
      status: raw.status || '正常'
    }
  } catch {
    errorMsg.value = '加载物料详情失败'
  } finally {
    loading.value = false
  }
}

function fmtQty(v) { return v == null || v === '' ? '--' : v }
</script>

<style scoped>
/* ===== Header ===== */
.header-top {
  width: 100%;
  height: 44px;
  background: #007cff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-sizing: border-box;
  font-size: 16px;
  font-weight: 400;
  color: #ffffff;
  position: sticky;
  top: 0;
  z-index: 20;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.back-icon {
  width: 10px;
  height: 10px;
  border-left: 2px solid #ffffff;
  border-bottom: 2px solid #ffffff;
  transform: rotate(45deg);
}

/* ===== Content ===== */
.material-detail {
  min-height: 100vh;
  background: #f5f8f9;
}
.content {
  --ink: #1d2433;
  --muted: #5a6b7c;
  --line: #e3e9f2;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  --fresh: #21c189;
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  color: var(--ink);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== Loading ===== */
.page-mask {
  position: fixed;
  inset: 0;
  background: rgba(247, 249, 252, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 30;
  backdrop-filter: blur(6px);
}
.spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid rgba(27, 109, 255, 0.2);
  border-top-color: var(--accent);
  animation: spin 0.9s linear infinite;
}
.mask-text {
  font-size: 13px;
  color: var(--muted);
}

/* ===== Hero Card ===== */
.hero-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: 0 16px 36px rgba(20, 37, 90, 0.12);
  animation: riseIn 0.5s ease both;
}
.title-row h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(27, 109, 255, 0.1);
  color: var(--accent-dark);
}
.tag.brand {
  background: rgba(33, 193, 137, 0.1);
  color: #0f7b52;
}
.tag.unit {
  background: rgba(255, 178, 74, 0.15);
  color: #9a6e18;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-label {
  font-size: 12px;
  color: var(--muted);
}
.summary-value {
  font-size: 14px;
  font-weight: 600;
}
.summary-value.mono {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.summary-value.highlight {
  color: var(--accent);
  font-size: 16px;
}

/* ===== Detail Card ===== */
.detail-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 8px 20px rgba(20, 37, 90, 0.07);
  animation: riseIn 0.6s ease both;
}
.card-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.detail-label {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}
.detail-value {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}
.detail-value.mono {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.detail-value.highlight {
  color: var(--accent);
}
.detail-value.status-ok {
  color: #21c189;
}

/* ===== States ===== */
.state {
  text-align: center;
  padding: 14px;
  color: var(--muted);
}
.state.error { color: #ff4d4f; }

/* ===== Animations ===== */
@keyframes riseIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
