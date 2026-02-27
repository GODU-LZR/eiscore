<template>
  <div class="loc-check">
    <div class="header-bar">
      <button class="back-btn" @click="goBack"><i class="back-icon" /> 返回</button>
      <h2>库位盘点</h2>
      <span />
    </div>
    <div class="body">
      <!-- Location Summary -->
      <section class="panel summary">
        <div class="title-row">
          <h2>{{ locInfo.name || '库位信息' }}</h2>
          <span class="code">{{ locCode }}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span class="label">库位编号</span><span class="value">{{ locInfo.code || locCode }}</span></div>
          <div class="meta-item"><span class="label">所属仓库</span><span class="value">{{ whInfo.name || '--' }}</span></div>
          <div class="meta-item"><span class="label">状态</span><span class="value">{{ locInfo.status || '--' }}</span></div>
        </div>
      </section>

      <!-- Scan Section -->
      <section class="panel scan">
        <div class="section-title">
          <h3>物料盘点</h3>
          <span class="total">物料数: {{ materials.length }}</span>
        </div>
        <div class="scan-actions">
          <button class="primary" @click="scanMaterial">扫描物料</button>
          <span class="hint">扫描物料码后可快速定位并填写实盘数</span>
        </div>
        <div v-if="activeMaterial" class="active-card">
          <div class="active-title">当前扫描物料</div>
          <div class="active-content">
            <div>
              <div class="active-name">{{ activeMaterial.material_name }}</div>
              <div class="active-code">{{ activeMaterial.material_code }}</div>
            </div>
            <div class="active-qty">账面: {{ fmtQty(activeMaterial.available_qty) }} {{ activeMaterial.unit || '' }}</div>
          </div>
        </div>
      </section>

      <!-- Material List -->
      <section class="panel list">
        <div v-if="loading" class="state">正在加载...</div>
        <div v-else-if="error" class="state error">{{ error }}</div>
        <div v-else-if="materials.length === 0" class="state empty">当前库位暂无物料</div>
        <div v-else class="material-list">
          <div
            v-for="mat in materials" :key="mat.material_id"
            class="material-row" :class="{ active: mat.material_code === activeCode }"
          >
            <div class="material-main">
              <div class="material-name">{{ mat.material_name || '--' }}</div>
              <div class="material-code">{{ mat.material_code || '--' }}</div>
              <div class="material-spec">{{ mat.material_category || '-' }}</div>
            </div>
            <div class="material-right">
              <div class="qty">账面: {{ fmtQty(mat.available_qty) }} {{ mat.unit || '' }}</div>
              <div class="input-row">
                <input
                  :ref="el => { if (el) inputRefs[mat.material_id] = el }"
                  v-model="mat.checkQty" type="number" placeholder="实盘数"
                />
                <span class="diff" :class="diffClass(mat)">{{ formatDiff(mat) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Submit -->
      <section class="panel submit">
        <div class="submit-row">
          <input v-model.trim="checkBy" type="text" placeholder="盘点人" />
          <button class="primary" :disabled="submitting" @click="submitCheck">
            {{ submitting ? '提交中...' : '提交盘点' }}
          </button>
        </div>
        <div class="hint">只会提交填写了实盘数的物料记录。盘盈自动生成入库调整单, 盘亏自动生成出库调整单。</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchWarehouseByCode, fetchInventoryByLocation,
  createCheck, createCheckItems, updateCheckStatus,
  createTransactions, adjustBatchQty, fetchBatch,
  buildCheckNo, buildTransactionNo
} from '@/api/check'
import request from '@/utils/request'
import { getCheckCache, getColdMode, addPendingCheck } from '@/utils/check-cache'

const route = useRoute()
const router = useRouter()

const locCode = ref(route.params.code || '')
const locInfo = ref({})
const whInfo = ref({})
const materials = ref([])
const activeCode = ref('')
const loading = ref(false)
const error = ref('')
const checkBy = ref('')
const submitting = ref(false)
const inputRefs = reactive({})

const activeMaterial = computed(() => materials.value.find(m => m.material_code === activeCode.value))

onMounted(() => {
  const user = localStorage.getItem('user_info')
  if (user) { try { checkBy.value = JSON.parse(user).username || '' } catch {} }
  loadAll()
})

async function loadAll () {
  loading.value = true; error.value = ''
  try {
    if (getColdMode()) {
      const cached = getFromCache()
      if (cached) { locInfo.value = cached.locInfo; whInfo.value = cached.whInfo; materials.value = cached.materials; return }
      error.value = '冷库模式未找到缓存数据'; return
    }
    // 查询库位
    const locRes = await fetchWarehouseByCode(locCode.value)
    const loc = Array.isArray(locRes) && locRes.length ? locRes[0] : null
    if (!loc) { error.value = '未找到库位'; return }
    locInfo.value = loc
    // 查询所属仓库
    if (loc.parent_id) {
      let parentId = loc.parent_id
      for (let i = 0; i < 3; i++) {
        const res = await request.get('/warehouses', {
          params: { id: `eq.${parentId}`, limit: 1 },
          headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' }
        })
        const p = Array.isArray(res) && res.length ? res[0] : null
        if (!p) break
        if (p.level === 1) { wh = p; break }
        parentId = p.parent_id
        if (!parentId) break
      }
      if (wh) whInfo.value = wh
    }
    // 查询库存
    const inv = await fetchInventoryByLocation(loc.id)
    materials.value = (Array.isArray(inv) ? inv : []).map(m => ({ ...m, checkQty: '' }))
  } catch { error.value = '加载库位信息失败' } finally { loading.value = false }
}

function getFromCache () {
  const cache = getCheckCache()
  if (!cache) return null
  for (const wh of (cache.warehouses || [])) {
    const loc = (wh.locations || []).find(l => l.code === locCode.value)
    if (loc) {
      return {
        whInfo: { id: wh.id, name: wh.name, code: wh.code },
        locInfo: { id: loc.id, code: loc.code, name: loc.name, status: '启用' },
        materials: (loc.materials || []).map(m => ({ ...m, checkQty: '' }))
      }
    }
  }
  return null
}

function scanMaterial () {
  ElMessageBox.prompt('请输入或粘贴物料码', '扫描物料', {
    confirmButtonText: '定位', cancelButtonText: '取消'
  }).then(({ value }) => {
    if (!value) return
    const raw = value.trim()
    const code = raw.toUpperCase().startsWith('MAT-') ? raw.slice(4) : raw
    const found = materials.value.find(m => m.material_code === raw || m.material_code === code)
    if (!found) { ElMessage.warning('该物料不在当前库位'); return }
    activeCode.value = found.material_code
    nextTick(() => {
      const el = inputRefs[found.material_id]
      if (el && el.focus) el.focus()
    })
  }).catch(() => {})
}

function formatDiff (mat) {
  const qty = Number(mat.available_qty) || 0
  const ck = mat.checkQty === '' ? null : Number(mat.checkQty)
  if (ck === null || isNaN(ck)) return ''
  const diff = ck - qty
  return `差异 ${diff > 0 ? '+' : ''}${diff}`
}
function diffClass (mat) {
  const qty = Number(mat.available_qty) || 0
  const ck = mat.checkQty === '' ? null : Number(mat.checkQty)
  if (ck === null || isNaN(ck)) return ''
  const diff = ck - qty
  if (diff > 0) return 'gain'
  if (diff < 0) return 'loss'
  return 'equal'
}

async function submitCheck () {
  const rows = materials.value.filter(m => m.checkQty !== '' && m.checkQty !== null)
  if (!rows.length) { ElMessage.warning('请至少填写一条实盘数'); return }
  if (!checkBy.value) { ElMessage.warning('请填写盘点人'); return }

  // 冷库模式: 保存到本地
  if (getColdMode()) {
    addPendingCheck({
      id: `cold-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      locCode: locCode.value, whId: whInfo.value?.id,
      checkBy: checkBy.value,
      items: rows.map(m => ({
        material_id: m.material_id, material_code: m.material_code,
        material_name: m.material_name, book_qty: m.available_qty,
        actual_qty: Number(m.checkQty), unit: m.unit,
        batch_id: m.batch_id, warehouse_id: m.warehouse_id
      })),
      createdAt: Date.now()
    })
    ElMessage.success('已保存至本地，退出冷库模式后提交')
    return
  }

  submitting.value = true
  try {
    const checkNo = buildCheckNo()
    // 1. 创建盘点单
    const checkRes = await createCheck({
      check_no: checkNo,
      warehouse_id: whInfo.value?.id || locInfo.value?.parent_id || null,
      check_date: new Date().toISOString().slice(0, 10),
      status: '进行中',
      total_items: rows.length,
      diff_count: rows.filter(m => Number(m.checkQty) !== Number(m.available_qty)).length,
      created_by: checkBy.value
    })
    const checkId = Array.isArray(checkRes) && checkRes.length ? checkRes[0].id : checkRes?.id
    if (!checkId) throw new Error('创建盘点单失败')

    // 2. 创建盘点明细
    const items = rows.map(m => ({
      check_id: checkId,
      material_id: m.material_id,
      batch_no: m.batch_no || '',
      warehouse_id: m.warehouse_id || locInfo.value?.id,
      book_qty: Number(m.available_qty) || 0,
      actual_qty: Number(m.checkQty),
      unit: m.unit || '',
      operator: checkBy.value,
      scan_time: new Date().toISOString()
    }))
    await createCheckItems(items)

    // 3. 生成盘盈/盘亏调整单
    const adjustments = []
    for (const m of rows) {
      const bookQty = Number(m.available_qty) || 0
      const actualQty = Number(m.checkQty)
      const diff = actualQty - bookQty
      if (diff === 0) continue

      const txType = diff > 0 ? '入库' : '出库'
      const relatedDocType = diff > 0 ? '盘盈调整' : '盘亏调整'
      adjustments.push({
        transaction_no: buildTransactionNo(diff > 0 ? 'PY' : 'PK'),
        transaction_type: txType,
        material_id: m.material_id,
        batch_no: m.batch_no || '',
        batch_id: m.batch_id || null,
        warehouse_id: m.warehouse_id || locInfo.value?.id,
        quantity: Math.abs(diff),
        unit: m.unit || '',
        before_qty: bookQty,
        after_qty: actualQty,
        related_doc_type: relatedDocType,
        related_doc_no: checkNo,
        operator: checkBy.value,
        remark: `${relatedDocType} - 盘点单 ${checkNo}`,
        approval_status: '已完成'
      })
    }
    if (adjustments.length) {
      await createTransactions(adjustments)
    }

    // 4. 更新库存批次数量
    for (const m of rows) {
      const bookQty = Number(m.available_qty) || 0
      const actualQty = Number(m.checkQty)
      if (actualQty === bookQty) continue
      // 找到对应批次
      const batchId = m.batch_id
      if (batchId) {
        await adjustBatchQty(batchId, actualQty)
      } else {
        // 尝试查找批次
        try {
          const batches = await fetchBatch(m.material_id, m.warehouse_id || locInfo.value?.id)
          const batch = Array.isArray(batches) && batches.length ? batches[0] : null
          if (batch) await adjustBatchQty(batch.id, actualQty)
        } catch { /* 无批次则跳过 */ }
      }
    }

    // 5. 更新盘点单状态
    await updateCheckStatus(checkId, '已生成调整单')

    ElMessage.success('盘点提交成功！盘盈/盘亏调整单已自动生成')
    // 刷新数据
    materials.value.forEach(m => { m.checkQty = '' })
    loadAll()
  } catch (err) {
    console.error(err)
    ElMessage.error('盘点提交失败: ' + (err.message || ''))
  } finally {
    submitting.value = false
  }
}

function goBack () { router.back() }
function fmtQty (v) { return v == null || v === '' ? '--' : v }
</script>

<style lang="scss" scoped>
.loc-check {
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
.panel {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 6px 16px rgba(27,46,94,.06);
}
.title-row { display: flex; justify-content: space-between; align-items: center; }
.title-row h2 { margin: 0; font-size: 18px; }
.code { font-family: Consolas, monospace; color: #5a6b7c; }
.meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 12px; }
.meta-item { display: flex; flex-direction: column; }
.meta-item .label { font-size: 12px; color: #8a97a6; }
.meta-item .value { margin-top: 4px; font-size: 14px; color: #1f2d3d; }
.section-title {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
  h3 { margin: 0; font-size: 16px; }
  .total { font-size: 12px; color: #8a97a6; }
}
.scan-actions { display: flex; align-items: center; gap: 12px; }
.primary {
  background: #1e6fff; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 14px; cursor: pointer;
  &:disabled { opacity: .6; cursor: not-allowed; }
}
.hint { font-size: 12px; color: #8a97a6; margin-top: 8px; }
.active-card {
  margin-top: 12px; padding: 12px; border-radius: 10px; background: #f2f7ff;
}
.active-title { font-size: 12px; color: #6680a0; margin-bottom: 6px; }
.active-content { display: flex; justify-content: space-between; align-items: center; }
.active-name { font-size: 14px; font-weight: 600; }
.active-code { font-size: 12px; color: #7c8a98; }
.active-qty { font-size: 12px; color: #1e6fff; }

.material-list { display: flex; flex-direction: column; gap: 10px; }
.material-row {
  padding: 12px; border: 1px solid #eef1f6; border-radius: 10px;
  display: flex; justify-content: space-between; gap: 12px;
}
.material-row.active { border-color: #1e6fff; box-shadow: 0 0 0 1px rgba(30,111,255,.2); }
.material-name { font-size: 14px; font-weight: 600; color: #1f2d3d; }
.material-code { font-size: 12px; color: #7f8c9a; }
.material-spec { font-size: 12px; color: #9aa7b5; }
.material-right { min-width: 160px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.qty { font-size: 12px; color: #5f6d7a; }
.input-row {
  display: flex; align-items: center; gap: 8px;
  input {
    width: 90px; padding: 6px 8px; border-radius: 6px; border: 1px solid #d7dde6; font-size: 12px; text-align: right;
    outline: none;
    &:focus { border-color: #1e6fff; }
  }
}
.diff { font-size: 12px; min-width: 70px; text-align: right; }
.diff.gain { color: #21c189; font-weight: 600; }
.diff.loss { color: #ff4d4f; font-weight: 600; }
.diff.equal { color: #94a3b8; }
.submit-row {
  display: flex; gap: 8px;
  input {
    flex: 1; border: 1px solid #d7dde6; border-radius: 8px; padding: 8px 10px; font-size: 13px;
    outline: none;
    &:focus { border-color: #1e6fff; }
  }
}
.state { text-align: center; padding: 12px; color: #8a97a6; &.error { color: #ff4d4f; } }
</style>
