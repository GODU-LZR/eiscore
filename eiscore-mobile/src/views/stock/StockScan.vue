<template>
  <div class="stock-scan">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()"><i class="back-icon" /></span>
      <p>扫码出入库</p>
      <span />
    </div>

    <div class="content">
      <!-- 全屏加载遮罩 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMsg }}</div>
      </div>

      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Stock I/O</span>
          <h1>扫码出入库</h1>
          <p>扫码或手动输入，快速完成出入库操作。</p>
        </div>
        <!-- 出入库类型切换 -->
        <div class="type-switch">
          <button
            class="type-btn"
            :class="{ active: mode === 'in' }"
            @click="switchMode('in')"
          >
            <span class="type-label">入库</span>
            <span class="type-hint">物料入库登记</span>
          </button>
          <button
            class="type-btn"
            :class="{ active: mode === 'out' }"
            @click="switchMode('out')"
          >
            <span class="type-label">出库</span>
            <span class="type-hint">物料出库登记</span>
          </button>
        </div>
      </section>

      <!-- 扫码/搜索区 -->
      <section class="search-card">
        <div class="search-row">
          <input
            ref="scanInput"
            v-model.trim="scanCode"
            type="text"
            placeholder="扫码或输入物料编码/名称"
            @keyup.enter="handleScan"
          />
          <button class="search-btn" @click="handleScan">查询</button>
        </div>
        <div class="search-meta">
          <span class="meta-pill">扫描物料条码</span>
          <button v-if="scanCode" class="clear-btn" @click="scanCode = ''">清空</button>
        </div>
        <!-- 搜索结果列表 -->
        <transition name="fade">
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="mat in searchResults"
              :key="mat.id"
              class="search-item"
              @click="selectMaterial(mat)"
            >
              <div class="search-item-info">
                <div class="search-item-name">{{ mat.name }}</div>
                <div class="search-item-code">{{ mat.batch_no || '--' }}</div>
              </div>
              <span class="search-item-cat">{{ mat.category || '--' }}</span>
            </div>
          </div>
        </transition>
      </section>

      <!-- 统计行 -->
      <section class="stats-row">
        <div class="stat-card">
          <div class="stat-label">今日{{ mode === 'in' ? '入库' : '出库' }}</div>
          <div class="stat-value">{{ todayCount }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">当前模式</div>
          <div class="stat-value">{{ mode === 'in' ? '入库' : '出库' }}</div>
        </div>
        <div class="stat-card dark">
          <div class="stat-label">待确认</div>
          <div class="stat-value">{{ pendingItems.length }}</div>
        </div>
      </section>

      <!-- 出入库表单（选择物料后） -->
      <transition name="fade">
        <section v-if="selectedMaterial" class="form-section">
          <div class="section-head">
            <div>
              <h2>{{ mode === 'in' ? '入库登记' : '出库登记' }}</h2>
              <p>确认物料信息并填写出入库数据</p>
            </div>
            <button class="ghost-btn" @click="resetForm">重置</button>
          </div>

          <!-- 物料信息卡 -->
          <div class="material-card">
            <div class="material-head">
              <div class="material-info">
                <div class="material-name">{{ selectedMaterial.name }}</div>
                <div class="material-code">{{ selectedMaterial.batch_no || '--' }}</div>
              </div>
              <span class="material-cat">{{ selectedMaterial.category || '--' }}</span>
            </div>
            <div class="material-props" v-if="selectedMaterial.properties">
              <span v-if="selectedMaterial.properties.spec">规格: {{ selectedMaterial.properties.spec }}</span>
              <span v-if="selectedMaterial.properties.unit">单位: {{ selectedMaterial.properties.unit }}</span>
            </div>
          </div>

          <!-- 仓库选择 -->
          <div class="form-card">
            <div class="form-label">目标仓库 <span class="required">*</span></div>
            <div class="select-group">
              <div class="select-wrap">
                <select v-model="form.warehouseId" @change="onWarehouseChange">
                  <option value="">请选择仓库</option>
                  <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }} ({{ w.code }})</option>
                </select>
              </div>
              <div class="select-wrap" v-if="subLocations.length > 0">
                <select v-model="form.locationId" @change="onLocationChange">
                  <option value="">请选择库区/库位</option>
                  <option v-for="loc in subLocations" :key="loc.id" :value="loc.id">{{ loc.name }} ({{ loc.code }})</option>
                </select>
              </div>
              <div class="select-wrap" v-if="subLocations2.length > 0">
                <select v-model="form.locationId2">
                  <option value="">请选择库位</option>
                  <option v-for="loc in subLocations2" :key="loc.id" :value="loc.id">{{ loc.name }} ({{ loc.code }})</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 出库：批次选择 -->
          <div v-if="mode === 'out'" class="form-card">
            <div class="form-label">选择批次 <span class="required">*</span></div>
            <div v-if="batchLoading" class="state">加载批次...</div>
            <div v-else-if="availableBatches.length === 0" class="state empty">该库位无可用批次</div>
            <div v-else class="batch-list">
              <div
                v-for="b in availableBatches"
                :key="b.id"
                class="batch-item"
                :class="{ selected: form.batchNo === b.batch_no }"
                @click="selectBatch(b)"
              >
                <div class="batch-info">
                  <div class="batch-no">{{ b.batch_no }}</div>
                  <div class="batch-meta">可用: {{ fmtQty(b.available_qty) }} {{ b.unit || '--' }}</div>
                </div>
                <div class="batch-check" v-if="form.batchNo === b.batch_no">✓</div>
              </div>
            </div>
          </div>

          <!-- 入库：批次号 -->
          <div v-if="mode === 'in'" class="form-card">
            <div class="form-label">批次号</div>
            <input
              v-model.trim="form.batchNo"
              type="text"
              placeholder="留空则自动生成"
              class="form-input"
            />
          </div>

          <!-- 出入库类型 -->
          <div class="form-card">
            <div class="form-label">{{ mode === 'in' ? '入库' : '出库' }}类型</div>
            <div class="type-pills">
              <span
                v-for="t in currentIoTypes"
                :key="t.value"
                class="type-pill"
                :class="{ active: form.ioType === t.value }"
                @click="form.ioType = t.value"
              >{{ t.label }}</span>
            </div>
          </div>

          <!-- 数量 -->
          <div class="form-card">
            <div class="form-label">数量 <span class="required">*</span></div>
            <div class="qty-row">
              <input
                v-model.number="form.quantity"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.01"
                placeholder="输入数量"
                class="form-input qty-input"
              />
              <span class="qty-unit">{{ materialUnit }}</span>
            </div>
            <div v-if="mode === 'out' && selectedBatch" class="qty-hint">
              可用库存: {{ fmtQty(selectedBatch.available_qty) }} {{ selectedBatch.unit || '--' }}
            </div>
          </div>

          <!-- 生产日期（入库） -->
          <div v-if="mode === 'in'" class="form-card">
            <div class="form-label">生产日期</div>
            <input
              v-model="form.productionDate"
              type="date"
              class="form-input"
            />
          </div>

          <!-- 备注 -->
          <div class="form-card">
            <div class="form-label">备注</div>
            <textarea
              v-model.trim="form.remark"
              placeholder="选填备注信息"
              class="form-textarea"
              rows="2"
            />
          </div>

          <!-- 提交按钮 -->
          <button
            class="submit-btn"
            :class="{ disabled: submitting }"
            :disabled="submitting"
            @click="handleSubmit"
          >
            {{ submitting ? '正在提交...' : (mode === 'in' ? '确认入库' : '确认出库') }}
          </button>
        </section>
      </transition>

      <!-- 最近操作记录 -->
      <section class="history-section">
        <div class="section-head">
          <div>
            <h2>最近操作</h2>
            <p>本次会话的出入库记录</p>
          </div>
          <button class="ghost-btn" @click="loadRecentTransactions">刷新</button>
        </div>

        <div v-if="recentTransactions.length === 0" class="state empty">暂无操作记录</div>
        <div v-else class="history-list">
          <div
            v-for="tx in recentTransactions"
            :key="tx.id"
            class="history-card"
          >
            <div class="history-head">
              <span class="history-type" :class="tx.transaction_type === '入库' ? 'type-in' : 'type-out'">
                {{ tx.transaction_type }}
              </span>
              <span class="history-no">{{ tx.transaction_no }}</span>
            </div>
            <div class="history-body">
              <div class="history-row">
                <span class="history-label">物料</span>
                <span>{{ tx.material_name || '--' }}</span>
              </div>
              <div class="history-row">
                <span class="history-label">数量</span>
                <span :class="tx.quantity > 0 ? 'positive' : 'negative'">
                  {{ tx.quantity > 0 ? '+' : '' }}{{ fmtQty(tx.quantity) }} {{ tx.unit || '--' }}
                </span>
              </div>
              <div class="history-row">
                <span class="history-label">仓库</span>
                <span>{{ tx.warehouse_name || '--' }}</span>
              </div>
              <div class="history-row" v-if="tx.io_type">
                <span class="history-label">类型</span>
                <span>{{ tx.io_type }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { getUserInfo } from '@/utils/auth'
import {
  fetchWarehouses, fetchLocationsByWarehouse,
  fetchMaterialByCode, searchMaterials,
  fetchBatches, fetchBatchesByWarehouse,
  stockIn, stockOut,
  fetchRecentTransactions,
  buildInNo, buildOutNo,
  IO_TYPES_IN, IO_TYPES_OUT
} from '@/api/stock'

const router = useRouter()

/* ---------- 状态 ---------- */
const pageLoading = ref(false)
const loadingMsg = ref('正在加载...')
const mode = ref('in') // 'in' | 'out'
const scanCode = ref('')
const scanInput = ref(null)
const searchResults = ref([])

// 仓库
const warehouses = ref([])
const subLocations = ref([])
const subLocations2 = ref([])

// 物料 & 批次
const selectedMaterial = ref(null)
const availableBatches = ref([])
const selectedBatch = ref(null)
const batchLoading = ref(false)

// 表单
const form = ref({
  warehouseId: '',
  locationId: '',
  locationId2: '',
  batchNo: '',
  ioType: '',
  quantity: null,
  productionDate: '',
  remark: ''
})

const submitting = ref(false)
const todayCount = ref(0)
const pendingItems = ref([])
const recentTransactions = ref([])

/* ---------- 计算属性 ---------- */
const currentIoTypes = computed(() => mode.value === 'in' ? IO_TYPES_IN : IO_TYPES_OUT)

const materialUnit = computed(() => {
  const m = selectedMaterial.value
  if (!m) return '--'
  return m.properties?.unit || m.properties?.measure_unit || '--'
})

/** 实际入库的目标仓库 ID（取最深层级） */
const targetWarehouseId = computed(() => {
  return form.value.locationId2 || form.value.locationId || form.value.warehouseId
})

/* ---------- 方法 ---------- */

function switchMode(m) {
  mode.value = m
  form.value.ioType = ''
  form.value.batchNo = ''
  availableBatches.value = []
  selectedBatch.value = null
  // 切换时重新加载批次
  if (selectedMaterial.value && targetWarehouseId.value && m === 'out') {
    loadBatches()
  }
}

async function handleScan() {
  const code = scanCode.value
  if (!code) return

  pageLoading.value = true
  loadingMsg.value = '正在查询物料...'
  searchResults.value = []
  try {
    // 先精确查编码
    const exact = await fetchMaterialByCode(code)
    if (Array.isArray(exact) && exact.length > 0) {
      selectMaterial(exact[0])
      searchResults.value = []
      return
    }
    // 模糊搜索
    const list = await searchMaterials(code)
    if (Array.isArray(list) && list.length > 0) {
      if (list.length === 1) {
        selectMaterial(list[0])
      } else {
        searchResults.value = list
      }
    } else {
      showToast({ message: '未找到匹配物料', icon: 'warning-o' })
    }
  } catch (e) {
    showToast({ message: `查询失败: ${e.message}`, icon: 'fail' })
  } finally {
    pageLoading.value = false
  }
}

function selectMaterial(mat) {
  selectedMaterial.value = mat
  searchResults.value = []
  scanCode.value = mat.batch_no || mat.name
  form.value.batchNo = ''
  selectedBatch.value = null
  availableBatches.value = []
  // 加载仓库
  loadWarehouses()
}

async function loadWarehouses() {
  try {
    const list = await fetchWarehouses()
    warehouses.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载仓库失败', e)
  }
}

async function onWarehouseChange() {
  form.value.locationId = ''
  form.value.locationId2 = ''
  subLocations.value = []
  subLocations2.value = []
  availableBatches.value = []
  selectedBatch.value = null

  const id = form.value.warehouseId
  if (!id) return
  try {
    const list = await fetchLocationsByWarehouse(id)
    subLocations.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载库区失败', e)
  }

  if (mode.value === 'out') loadBatches()
}

async function onLocationChange() {
  form.value.locationId2 = ''
  subLocations2.value = []
  availableBatches.value = []
  selectedBatch.value = null

  const id = form.value.locationId
  if (!id) return
  try {
    const list = await fetchLocationsByWarehouse(id)
    subLocations2.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载库位失败', e)
  }

  if (mode.value === 'out') loadBatches()
}

async function loadBatches() {
  const mat = selectedMaterial.value
  const wid = targetWarehouseId.value
  if (!mat || !wid) return

  batchLoading.value = true
  try {
    const list = await fetchBatches(mat.id, wid)
    availableBatches.value = (Array.isArray(list) ? list : []).filter(b => b.available_qty > 0)
  } catch (e) {
    console.error('加载批次失败', e)
    availableBatches.value = []
  } finally {
    batchLoading.value = false
  }
}

function selectBatch(b) {
  form.value.batchNo = b.batch_no
  selectedBatch.value = b
}

function resetForm() {
  selectedMaterial.value = null
  form.value = {
    warehouseId: '',
    locationId: '',
    locationId2: '',
    batchNo: '',
    ioType: '',
    quantity: null,
    productionDate: '',
    remark: ''
  }
  subLocations.value = []
  subLocations2.value = []
  availableBatches.value = []
  selectedBatch.value = null
  scanCode.value = ''
  searchResults.value = []
  nextTick(() => scanInput.value?.focus())
}

async function handleSubmit() {
  // 校验
  if (!selectedMaterial.value) return showToast('请先选择物料')
  if (!targetWarehouseId.value) return showToast('请选择目标仓库/库位')
  if (!form.value.quantity || form.value.quantity <= 0) return showToast('请输入有效数量')

  if (mode.value === 'out') {
    if (!form.value.batchNo) return showToast('请选择出库批次')
    if (selectedBatch.value && form.value.quantity > selectedBatch.value.available_qty) {
      return showToast(`出库数量不能超过可用库存 ${selectedBatch.value.available_qty}`)
    }
  }

  const mat = selectedMaterial.value
  const actionText = mode.value === 'in' ? '入库' : '出库'
  const batchNo = form.value.batchNo || buildInNo()

  try {
    await showConfirmDialog({
      title: `确认${actionText}`,
      message: `${mat.name}\n数量: ${form.value.quantity} ${materialUnit.value}\n${actionText}类型: ${form.value.ioType || '未指定'}`
    })
  } catch { return }

  const user = getUserInfo()
  const operator = user?.full_name || user?.username || '移动端用户'

  submitting.value = true
  try {
    const payload = {
      material_id: mat.id,
      warehouse_id: targetWarehouseId.value,
      quantity: form.value.quantity,
      unit: materialUnit.value !== '--' ? materialUnit.value : null,
      batch_no: batchNo,
      transaction_no: mode.value === 'in' ? buildInNo() : buildOutNo(),
      operator,
      remark: form.value.remark || null,
      io_type: form.value.ioType || null
    }

    if (mode.value === 'in') {
      payload.production_date = form.value.productionDate || null
      await stockIn(payload)
    } else {
      await stockOut(payload)
    }

    showToast({ message: `${actionText}成功`, icon: 'success' })
    todayCount.value++
    resetForm()
    loadRecentTransactions()
  } catch (e) {
    let msg = e.message || `${actionText}失败`
    if (msg.includes('INSUFFICIENT_QTY')) msg = '库存不足，出库失败'
    if (msg.includes('BATCH_NOT_FOUND')) msg = '批次不存在，请重新选择'
    showToast({ message: msg, icon: 'fail' })
  } finally {
    submitting.value = false
  }
}

async function loadRecentTransactions() {
  try {
    const list = await fetchRecentTransactions(10)
    recentTransactions.value = Array.isArray(list) ? list : []
  } catch { /* ignore */ }
}

function fmtQty(v) {
  if (v == null) return '--'
  const n = Number(v)
  return Number.isFinite(n) ? (Number.isInteger(n) ? n.toString() : n.toFixed(2)) : '--'
}

/* ---------- 初始化 ---------- */
onMounted(async () => {
  loadWarehouses()
  loadRecentTransactions()
})
</script>

<style scoped>
/* ===== Header ===== */
.header-top{width:100%;height:44px;background:#007cff;display:flex;justify-content:space-between;align-items:center;padding:0 20px;box-sizing:border-box;font-size:16px;color:#fff;position:sticky;top:0;z-index:20}
.back-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer}
.back-icon{width:10px;height:10px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}

/* ===== Content ===== */
.content {
  --ink: #1d2433;
  --muted: #5a6b7c;
  --line: #e3e9f2;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  --fresh: #21c189;
  font-family: 'Source Han Sans CN','Noto Sans SC','Microsoft YaHei',sans-serif;
  color: var(--ink);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 44px);
  background:
    radial-gradient(700px 280px at 10% -10%, rgba(27,109,255,0.16), transparent 65%),
    radial-gradient(600px 260px at 100% 20%, rgba(33,193,137,0.14), transparent 60%),
    linear-gradient(140deg, #f9fbff 0%, #f1f6ff 50%, #f6fbf8 100%);
}

/* ===== Loading ===== */
.page-mask{position:fixed;inset:0;background:rgba(255,255,255,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100}
.spinner{width:36px;height:36px;border:3px solid #e3e9f2;border-top-color:#1b6dff;border-radius:50%;animation:spin .7s linear infinite}
.mask-text{margin-top:12px;color:#5a6b7c;font-size:14px}
@keyframes spin{to{transform:rotate(360deg)}}

/* ===== Hero ===== */
.hero {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(255,255,255,0.92);
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 18px 40px rgba(20,37,90,0.12);
  animation: riseIn 0.6s ease both;
}
.hero-copy h1{margin:8px 0 6px;font-size:22px;letter-spacing:.5px}
.hero-copy p{margin:0;color:var(--muted);font-size:14px}
.hero-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;color:var(--accent-dark);background:rgba(27,109,255,0.12);letter-spacing:.4px}

/* Type Switch */
.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.type-btn {
  border: none;
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  background: #f4f6fa;
  border: 2px solid transparent;
}
.type-btn.active {
  color: #fff;
  border-color: transparent;
}
.type-btn.active:first-child {
  background: linear-gradient(135deg, #21c189 0%, #4ad6a8 100%);
  box-shadow: 0 12px 24px rgba(33,193,137,0.24);
}
.type-btn.active:last-child {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  box-shadow: 0 12px 24px rgba(245,158,11,0.24);
}
.type-btn:active{transform:translateY(1px)}
.type-label{font-size:16px;font-weight:600}
.type-hint{font-size:12px;opacity:.85}

/* ===== Search Card ===== */
.search-card{background:#fff;border-radius:18px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 10px 24px rgba(20,37,90,0.07);padding:14px 16px;animation:riseIn .5s ease both}
.search-row{display:flex;gap:10px;overflow:hidden;box-sizing:border-box}
.search-row input{flex:1;border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px;outline:none;transition:border .2s;min-width:0}
.search-row input:focus{border-color:var(--accent)}
.search-btn{background:var(--accent);color:#fff;border:none;border-radius:12px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0}
.search-btn:active{opacity:.8}
.search-meta{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;font-size:12px}
.meta-pill{background:rgba(27,109,255,0.08);color:var(--accent);padding:3px 10px;border-radius:999px}
.clear-btn{border:none;background:rgba(239,68,68,0.1);color:#ef4444;padding:3px 10px;border-radius:999px;font-size:12px;cursor:pointer}

/* Search Results */
.search-results{margin-top:10px;max-height:200px;overflow-y:auto;border:1px solid var(--line);border-radius:12px}
.search-item{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #f0f3f8;cursor:pointer;transition:background .15s}
.search-item:last-child{border-bottom:none}
.search-item:active{background:#f7f9fc}
.search-item-name{font-size:14px;font-weight:500}
.search-item-code{font-size:12px;color:var(--muted);margin-top:2px}
.search-item-cat{font-size:12px;color:var(--accent);background:rgba(27,109,255,0.08);padding:3px 8px;border-radius:999px;white-space:nowrap}

/* ===== Stats ===== */
.stats-row{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);animation:riseIn .7s ease both}
.stat-card{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 8px 20px rgba(20,37,90,0.08)}
.stat-card.accent{background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);color:#fff}
.stat-card.dark{background:linear-gradient(135deg,#1f2d3d 0%,#44556b 100%);color:#fff}
.stat-label{font-size:12px;opacity:.8}
.stat-value{font-size:16px;font-weight:700;margin-top:6px}

/* ===== Section Head ===== */
.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.section-head h2{margin:0 0 4px;font-size:18px}
.section-head p{margin:0;font-size:12px;color:var(--muted)}
.ghost-btn{border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:6px 14px;font-size:13px;color:var(--accent);cursor:pointer}
.ghost-btn:active{background:#f7f9fc}

/* ===== Form Section ===== */
.form-section{display:flex;flex-direction:column;gap:12px;animation:riseIn .5s ease both}

/* Material Card */
.material-card{background:#fff;border-radius:16px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 8px 20px rgba(20,37,90,0.07);padding:14px 16px}
.material-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.material-info{flex:1;min-width:0}
.material-name{font-size:16px;font-weight:600}
.material-code{font-size:13px;color:var(--muted);margin-top:3px}
.material-cat{font-size:12px;color:var(--accent);background:rgba(27,109,255,0.08);padding:3px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.material-props{display:flex;gap:12px;margin-top:10px;font-size:12px;color:var(--muted);flex-wrap:wrap}

/* Form Cards */
.form-card{background:#fff;border-radius:16px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 8px 20px rgba(20,37,90,0.07);padding:14px 16px}
.form-label{font-size:14px;font-weight:600;margin-bottom:8px}
.required{color:#ef4444}
.select-group{display:flex;flex-direction:column;gap:8px}
.select-wrap select{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px;outline:none;background:#fff;color:var(--ink);appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a6b7c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
.form-input{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box;transition:border .2s}
.form-input:focus{border-color:var(--accent)}
.form-textarea{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box;resize:none;font-family:inherit;transition:border .2s}
.form-textarea:focus{border-color:var(--accent)}

/* Type Pills */
.type-pills{display:flex;gap:8px;flex-wrap:wrap}
.type-pill{padding:6px 14px;border-radius:999px;font-size:13px;border:1.5px solid var(--line);color:var(--muted);cursor:pointer;transition:all .2s}
.type-pill.active{background:var(--accent);color:#fff;border-color:var(--accent)}

/* Qty Row */
.qty-row{display:flex;align-items:center;gap:10px}
.qty-input{flex:1}
.qty-unit{font-size:14px;color:var(--muted);font-weight:500;white-space:nowrap}
.qty-hint{margin-top:6px;font-size:12px;color:var(--fresh)}

/* Batch List */
.batch-list{display:flex;flex-direction:column;gap:8px}
.batch-item{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:12px;background:#f7f9fc;cursor:pointer;transition:all .15s;border:2px solid transparent}
.batch-item.selected{border-color:var(--accent);background:rgba(27,109,255,0.04)}
.batch-item:active{background:#eef3fb}
.batch-no{font-size:14px;font-weight:500}
.batch-meta{font-size:12px;color:var(--muted);margin-top:2px}
.batch-check{color:var(--accent);font-weight:700;font-size:16px}

/* ===== Submit ===== */
.submit-btn{width:100%;padding:14px;border:none;border-radius:16px;font-size:16px;font-weight:600;color:#fff;cursor:pointer;transition:all .2s;background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);box-shadow:0 12px 24px rgba(27,109,255,0.24)}
.submit-btn:active{transform:translateY(1px)}
.submit-btn.disabled{opacity:.5;pointer-events:none}

/* ===== History ===== */
.history-section{animation:riseIn .6s ease both}
.history-list{display:flex;flex-direction:column;gap:10px}
.history-card{background:#fff;border-radius:16px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 8px 20px rgba(20,37,90,0.06);padding:14px 16px;animation:riseIn .5s ease both}
.history-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.history-type{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
.type-in{background:rgba(33,193,137,0.12);color:#0f7b52}
.type-out{background:rgba(245,158,11,0.12);color:#92600a}
.history-no{font-size:12px;color:var(--muted)}
.history-body{display:flex;flex-direction:column;gap:4px}
.history-row{display:flex;justify-content:space-between;font-size:13px}
.history-label{color:var(--muted)}
.positive{color:#21c189;font-weight:600}
.negative{color:#f59e0b;font-weight:600}

/* ===== States ===== */
.state{text-align:center;padding:16px;font-size:13px;color:var(--muted)}
.state.error{color:#ef4444}
.state.empty{color:var(--muted)}

/* ===== Transitions ===== */
.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}
.fade-enter-from,.fade-leave-to{opacity:0}

@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
</style>
