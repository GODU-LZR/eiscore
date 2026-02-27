<template>
  <div class="location-detail">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>库位盘点</p>
      <span />
    </div>

    <div class="content">
      <!-- 加载态 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMsg }}</div>
      </div>

      <!-- 汇总面板 -->
      <section v-if="location" class="summary-panel">
        <div class="title-row">
          <h2>{{ location.name || '未命名库位' }}</h2>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">库位编号</span>
            <span class="meta-value mono">{{ location.code || '--' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">仓库名称</span>
            <span class="meta-value">{{ warehouseName }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">物料种类</span>
            <span class="meta-value">{{ materials.length }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">盘点状态</span>
            <span class="meta-value" :class="submitted ? 'status-done' : 'status-pending'">
              {{ submitted ? '已提交' : '待盘点' }}
            </span>
          </div>
        </div>
      </section>

      <!-- 错误态 -->
      <div v-if="errorMsg" class="state error">{{ errorMsg }}</div>

      <!-- 扫码输入区 -->
      <section class="scan-section">
        <div class="scan-row">
          <input
            ref="scanInput"
            v-model.trim="scanCode"
            type="text"
            placeholder="扫码或输入物料编码"
            @keyup.enter="handleScan"
          />
          <button class="scan-btn" @click="handleScan">定位</button>
        </div>
        <!-- 当前激活物料高亮卡 -->
        <transition name="fade">
          <div v-if="activeMaterial" class="active-card">
            <div class="active-info">
              <div class="active-name">{{ activeMaterial.material_name }}</div>
              <div class="active-code">{{ activeMaterial.material_code }}</div>
            </div>
            <div class="active-qty">
              系统: {{ fmtQty(activeMaterial.available_qty) }} {{ activeMaterial.unit || '--' }}
            </div>
          </div>
        </transition>
      </section>

      <!-- 物料列表 -->
      <section class="material-section">
        <div class="section-title">
          <h3>物料列表</h3>
          <span class="count-badge">{{ materials.length }}</span>
        </div>

        <div v-if="materials.length === 0 && !pageLoading" class="state empty">暂无物料信息</div>

        <div class="material-list">
          <div
            v-for="(mat, index) in materials"
            :key="mat.material_id"
            class="material-card"
            :class="{ active: activeMaterial && activeMaterial.material_id === mat.material_id }"
            :style="{ animationDelay: `${index * 0.04}s` }"
            :ref="el => { if (activeMaterial && activeMaterial.material_id === mat.material_id) activeRef = el }"
          >
            <div class="material-head">
              <div class="material-info">
                <div class="material-name">{{ mat.material_name || '--' }}</div>
                <div class="material-code">{{ mat.material_code || '--' }}</div>
              </div>
              <button class="text-btn" @click="goMaterial(mat.material_id)">详情</button>
            </div>

            <div class="material-body">
              <div class="qty-row">
                <div class="qty-item">
                  <span class="qty-label">系统数量</span>
                  <span class="qty-value">{{ fmtQty(mat.available_qty) }}</span>
                </div>
                <div class="qty-item input-cell">
                  <span class="qty-label">盘点数量</span>
                  <input
                    v-model.number="mat.checkQty"
                    type="number"
                    inputmode="decimal"
                    class="check-input"
                    :class="{ filled: mat.checkQty != null && mat.checkQty !== '' }"
                    placeholder="输入"
                    @focus="activeMaterial = mat"
                  />
                </div>
                <div class="qty-item">
                  <span class="qty-label">差异</span>
                  <span
                    class="qty-value"
                    :class="{
                      positive: getDiff(mat) > 0,
                      negative: getDiff(mat) < 0,
                      zero: getDiff(mat) === 0
                    }"
                  >
                    {{ getDiffText(mat) }}
                  </span>
                </div>
              </div>
              <div class="material-extra">
                <span>{{ mat.unit || '--' }}</span>
                <span v-if="mat.batch_no">批次 {{ mat.batch_no }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 提交区域 -->
      <section v-if="materials.length > 0" class="submit-section">
        <div class="submit-info">
          <div class="submit-row">
            <span class="submit-label">盘点人</span>
            <input
              v-model.trim="checkBy"
              type="text"
              placeholder="请输入盘点人姓名"
              class="submit-input"
            />
          </div>
          <div class="submit-summary">
            已填 {{ filledCount }} / {{ materials.length }}，差异 {{ diffCount }} 项
          </div>
        </div>
        <button
          class="submit-btn"
          :class="{ disabled: submitting || submitted }"
          :disabled="submitting || submitted"
          @click="handleSubmit"
        >
          {{ submitting ? '正在提交...' : submitted ? '已提交' : '提交盘点' }}
        </button>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  fetchWarehouses, fetchLocationsByWarehouse,
  fetchInventoryByLocation, fetchBatch,
  createCheck, createCheckItems, createTransactions,
  adjustBatchQty, updateCheckStatus,
  buildCheckNo, buildTransactionNo
} from '@/api/check'
import {
  getCheckCache, getColdMode,
  addPendingCheck
} from '@/utils/check-cache'

const route = useRoute()
const router = useRouter()

const locationCode = computed(() => route.params.code)
const location = ref(null)
const warehouseName = ref('--')
const materials = ref([])
const pageLoading = ref(false)
const loadingMsg = ref('正在加载库位数据...')
const errorMsg = ref('')
const scanCode = ref('')
const activeMaterial = ref(null)
const activeRef = ref(null)
const checkBy = ref('')
const submitting = ref(false)
const submitted = ref(false)

const filledCount = computed(() =>
  materials.value.filter(m => m.checkQty != null && m.checkQty !== '').length
)
const diffCount = computed(() =>
  materials.value.filter(m => {
    if (m.checkQty == null || m.checkQty === '') return false
    return Number(m.checkQty) !== Number(m.available_qty || 0)
  }).length
)

onMounted(() => loadLocation())

/* ----------- 加载库位 ----------- */
async function loadLocation() {
  pageLoading.value = true
  errorMsg.value = ''
  try {
    // 冷库缓存
    if (getColdMode()) {
      const cache = getCheckCache()
      if (cache) {
        for (const wh of (cache.warehouses || [])) {
          const loc = (wh.locations || []).find(l => l.code === locationCode.value)
          if (loc) {
            location.value = loc
            warehouseName.value = wh.name || '--'
            materials.value = (loc.materials || []).map(m => ({ ...m, checkQty: null }))
            pageLoading.value = false
            return
          }
        }
      }
    }

    // 在线: 先查库位
    const allWh = await fetchWarehouses()
    let foundLoc = null
    let foundWhName = '--'

    for (const wh of (Array.isArray(allWh) ? allWh : [])) {
      const locs = await fetchLocationsByWarehouse(wh.id)
      for (const l of (Array.isArray(locs) ? locs : [])) {
        if (l.code === locationCode.value) {
          foundLoc = l
          foundWhName = wh.name || '--'
          break
        }
        // level-2 嵌套
        if (l.level === 2) {
          const children = await fetchLocationsByWarehouse(l.id)
          for (const c of (Array.isArray(children) ? children : [])) {
            if (c.code === locationCode.value) {
              foundLoc = { ...c, name: `${l.name} / ${c.name}` }
              foundWhName = wh.name || '--'
              break
            }
          }
          if (foundLoc) break
        }
      }
      if (foundLoc) break
    }

    if (!foundLoc) {
      errorMsg.value = `未找到库位 ${locationCode.value}`
      return
    }

    location.value = foundLoc
    warehouseName.value = foundWhName

    const inv = await fetchInventoryByLocation(foundLoc.id)
    materials.value = (Array.isArray(inv) ? inv : []).map(m => ({ ...m, checkQty: null }))
  } catch {
    errorMsg.value = '加载库位数据失败'
  } finally {
    pageLoading.value = false
  }
}

/* ----------- 扫码定位 ----------- */
function handleScan() {
  if (!scanCode.value) return
  const target = scanCode.value.toUpperCase()
  const found = materials.value.find(m =>
    String(m.material_code).toUpperCase() === target ||
    String(m.material_name).includes(scanCode.value)
  )
  if (found) {
    activeMaterial.value = found
    nextTick(() => {
      if (activeRef.value) {
        activeRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  } else {
    showToast('未找到匹配物料')
  }
  scanCode.value = ''
}

/* ----------- 差异计算 ----------- */
function getDiff(mat) {
  if (mat.checkQty == null || mat.checkQty === '') return null
  return Number(mat.checkQty) - Number(mat.available_qty || 0)
}
function getDiffText(mat) {
  const d = getDiff(mat)
  if (d === null) return '--'
  if (d === 0) return '0'
  return d > 0 ? `+${d}` : `${d}`
}

/* ----------- 提交盘点 ----------- */
async function handleSubmit() {
  if (filledCount.value === 0) {
    showToast('请至少填写一项盘点数量')
    return
  }
  if (!checkBy.value) {
    showToast('请输入盘点人姓名')
    return
  }

  const filledItems = materials.value.filter(m => m.checkQty != null && m.checkQty !== '')

  try {
    await showConfirmDialog({
      title: '确认提交',
      message: `共 ${filledItems.length} 项物料，其中 ${diffCount.value} 项有差异，确认提交盘点单？`
    })
  } catch { return }

  submitting.value = true

  // 冷库模式：本地暂存
  if (getColdMode()) {
    const pending = {
      locationCode: locationCode.value,
      locationName: location.value?.name,
      warehouseName: warehouseName.value,
      checkBy: checkBy.value,
      items: filledItems.map(m => ({
        material_id: m.material_id,
        material_code: m.material_code,
        material_name: m.material_name,
        system_qty: m.available_qty,
        check_qty: m.checkQty,
        unit: m.unit,
        batch_no: m.batch_no,
        batch_id: m.batch_id,
        warehouse_id: m.warehouse_id,
        warehouse_code: m.warehouse_code
      })),
      createdAt: Date.now()
    }
    addPendingCheck(pending)
    submitted.value = true
    submitting.value = false
    showToast({ message: '已保存到本地待提交', icon: 'success' })
    return
  }

  // 在线提交
  try {
    const checkNo = buildCheckNo()
    const [check] = await createCheck({
      check_no: checkNo,
      warehouse_id: filledItems[0]?.warehouse_id || null,
      check_date: new Date().toISOString().slice(0, 10),
      check_by: checkBy.value,
      status: '进行中',
      remark: `库位盘点 ${location.value?.name || locationCode.value}`
    })

    const checkItems = filledItems.map(m => ({
      check_id: check.id,
      material_id: m.material_id,
      batch_id: m.batch_id || null,
      system_qty: m.available_qty || 0,
      check_qty: m.checkQty,
      diff_qty: Number(m.checkQty) - Number(m.available_qty || 0),
      remark: ''
    }))
    await createCheckItems(checkItems)

    // 库存调整
    for (const m of filledItems) {
      const diff = Number(m.checkQty) - Number(m.available_qty || 0)
      if (diff === 0) continue

      const txNo = buildTransactionNo(diff > 0 ? 'IN' : 'OUT')
      await createTransactions([{
        transaction_no: txNo,
        material_id: m.material_id,
        batch_id: m.batch_id || null,
        warehouse_id: m.warehouse_id,
        transaction_type: diff > 0 ? '盘盈入库' : '盘亏出库',
        quantity: Math.abs(diff),
        transaction_date: new Date().toISOString().slice(0, 10),
        operator: checkBy.value,
        remark: `盘点单 ${checkNo}`
      }])

      if (m.batch_id) {
        const batches = await fetchBatch(m.material_id, m.warehouse_id)
        if (batches && batches.length > 0) {
          const batch = batches[0]
          const newQty = Number(batch.available_qty || 0) + diff
          await adjustBatchQty(batch.id, Math.max(0, newQty))
        }
      }
    }

    await updateCheckStatus(check.id, '已完成')
    submitted.value = true
    showToast({ message: '盘点提交成功', icon: 'success' })
  } catch (err) {
    showToast(`提交失败: ${err.message || '未知错误'}`)
  } finally {
    submitting.value = false
  }
}

/* ----------- 导航 ----------- */
function goMaterial(id) { router.push(`/check/material/${id}`) }
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
.location-detail {
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

/* ===== Summary Panel ===== */
.summary-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 18px;
  padding: 16px 18px;
  box-shadow: 0 14px 30px rgba(20, 37, 90, 0.1);
  animation: riseIn 0.5s ease both;
}
.title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.meta-label {
  font-size: 12px;
  color: var(--muted);
}
.meta-value {
  font-size: 14px;
  font-weight: 600;
}
.meta-value.mono {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.meta-value.status-done { color: #21c189; }
.meta-value.status-pending { color: #ffb24a; }

/* ===== Scan Section ===== */
.scan-section {
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 10px 24px rgba(20, 37, 90, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: riseIn 0.6s ease both;
}
.scan-row {
  display: flex;
  gap: 10px;
}
.scan-row input {
  flex: 1;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  background: #f7f9fc;
  color: var(--ink);
  outline: none;
}
.scan-row input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(27, 109, 255, 0.12);
}
.scan-btn {
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* 高亮激活物料卡 */
.active-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(27, 109, 255, 0.1), rgba(33, 193, 137, 0.08));
  border: 1px solid rgba(27, 109, 255, 0.2);
}
.active-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-dark);
}
.active-code {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
}
.active-qty {
  font-size: 13px;
  color: var(--muted);
}

/* ===== Material Section ===== */
.material-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title h3 {
  margin: 0;
  font-size: 16px;
}
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  background: var(--accent);
  padding: 0 6px;
}

/* ===== Material Card ===== */
.material-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.material-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 8px 20px rgba(20, 37, 90, 0.06);
  overflow: hidden;
  animation: riseIn 0.5s ease both;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.material-card.active {
  border-color: var(--accent);
  box-shadow: 0 6px 24px rgba(27, 109, 255, 0.18);
}
.material-head {
  padding: 12px 14px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.material-name {
  font-size: 14px;
  font-weight: 600;
}
.material-code {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.text-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 0;
}

.material-body {
  padding: 10px 14px 14px;
}
.qty-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.qty-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.qty-label {
  font-size: 11px;
  color: var(--muted);
}
.qty-value {
  font-size: 15px;
  font-weight: 700;
}
.qty-value.positive { color: #21c189; }
.qty-value.negative { color: #ff4d4f; }
.qty-value.zero { color: var(--muted); }

.check-input {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  background: #f7f9fc;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.check-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(27, 109, 255, 0.12);
}
.check-input.filled {
  border-color: var(--accent);
  background: rgba(27, 109, 255, 0.06);
}

.material-extra {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--muted);
}

/* ===== Submit Section ===== */
.submit-section {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 10px 24px rgba(20, 37, 90, 0.08);
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: riseIn 0.7s ease both;
}
.submit-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.submit-label {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.submit-input {
  flex: 1;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  background: #f7f9fc;
  outline: none;
}
.submit-input:focus {
  border-color: var(--accent);
}
.submit-summary {
  font-size: 13px;
  color: var(--muted);
}
.submit-btn {
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #1b6dff 0%, #4b8bff 100%);
  box-shadow: 0 10px 24px rgba(27, 109, 255, 0.25);
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.submit-btn:active {
  opacity: 0.9;
}
.submit-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* ===== States ===== */
.state {
  text-align: center;
  padding: 14px;
  color: var(--muted);
}
.state.error { color: #ff4d4f; }
.state.empty { color: #94a3b8; }

/* ===== Animations ===== */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

@keyframes riseIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
