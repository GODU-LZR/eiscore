<template>
  <div class="pda-entry">
    <!-- 导航栏 -->
    <van-nav-bar
      title="PDA 盘点"
      left-arrow
      @click-left="router.back()"
      :safe-area-inset-top="true"
    />

    <!-- 扫码区 -->
    <div class="scan-section">
      <div class="scan-box" @click="startScan">
        <van-icon name="scan" size="48" color="#1677ff" />
        <p class="scan-text">点击扫码盘点</p>
        <p class="scan-hint">扫描仓位/物料条码开始盘点</p>
      </div>
    </div>

    <!-- 手动输入 -->
    <div class="manual-section">
      <van-cell-group inset title="手动查询">
        <van-search
          v-model="searchKeyword"
          placeholder="输入仓位编码或物料名称"
          show-action
          @search="onSearch"
          @cancel="searchKeyword = ''"
        />
      </van-cell-group>
    </div>

    <!-- 仓库列表 -->
    <div class="warehouse-section">
      <van-cell-group inset title="仓库列表">
        <van-cell
          v-for="wh in filteredWarehouses"
          :key="wh.code"
          :title="wh.name"
          :label="wh.code"
          is-link
          @click="enterWarehouse(wh)"
        >
          <template #right-icon>
            <van-tag type="primary" plain>进入</van-tag>
          </template>
        </van-cell>
        <van-empty
          v-if="filteredWarehouses.length === 0 && !warehouseLoading"
          description="暂无仓库数据"
          image="search"
        />
      </van-cell-group>
    </div>

    <!-- 最近盘点记录 -->
    <div class="recent-section">
      <van-cell-group inset title="最近盘点记录">
        <van-cell
          v-for="rec in recentRecords"
          :key="rec.id"
          :title="`${rec.warehouse_name || rec.warehouse_code} - ${rec.location_code || ''}`"
          :label="`盘点时间: ${formatDate(rec.check_date || rec.created_at)}`"
        >
          <template #value>
            <van-tag :type="rec.status === 'completed' ? 'success' : 'warning'">
              {{ rec.status === 'completed' ? '已完成' : '进行中' }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell v-if="recentRecords.length === 0" title="暂无盘点记录" />
      </van-cell-group>
    </div>

    <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getToken } from '@/utils/auth'

const router = useRouter()
const searchKeyword = ref('')
const warehouses = ref([])
const recentRecords = ref([])
const warehouseLoading = ref(false)

const filteredWarehouses = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return warehouses.value
  return warehouses.value.filter(
    (w) => w.name.toLowerCase().includes(kw) || w.code.toLowerCase().includes(kw)
  )
})

onMounted(async () => {
  await Promise.all([loadWarehouses(), loadRecentRecords()])
})

async function loadWarehouses() {
  warehouseLoading.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/warehouses?select=code,name&order=code.asc', {
      headers: {
        'Accept-Profile': 'scm',
        Authorization: `Bearer ${token}`
      }
    })
    if (res.ok) {
      warehouses.value = await res.json()
    }
  } catch (e) {
    console.error('加载仓库失败:', e)
  } finally {
    warehouseLoading.value = false
  }
}

async function loadRecentRecords() {
  try {
    const token = getToken()
    const res = await fetch(
      '/api/inventory_checks?select=id,warehouse_code,location_code,check_date,status,created_at&order=created_at.desc&limit=5',
      {
        headers: {
          'Accept-Profile': 'scm',
          Authorization: `Bearer ${token}`
        }
      }
    )
    if (res.ok) {
      recentRecords.value = await res.json()
    }
  } catch (e) {
    console.error('加载盘点记录失败:', e)
  }
}

function enterWarehouse(wh) {
  // 跳转到桌面版盘点详情（未来可做纯移动端页面）
  // 目前先用 iframe 或直接跳转
  showToast({ message: `进入 ${wh.name}`, icon: 'logistics' })
  // 可配合 materials 子应用的盘点页面
  window.location.href = `/materials/inventory-check/warehouse/${wh.code}`
}

function startScan() {
  // 在移动端浏览器中，原生扫码需要通过第三方库或 APP 桥接
  // 这里提供手动输入的降级方案
  showToast({ message: '请使用手动输入或 PDA 设备扫码', icon: 'scan' })
}

function onSearch() {
  if (!searchKeyword.value.trim()) return
  showToast(`搜索: ${searchKeyword.value}`)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.pda-entry {
  min-height: 100vh;
  background: var(--eis-bg);
}

.scan-section {
  padding: 20px 16px 8px;
}

.scan-box {
  background: linear-gradient(135deg, #e8f4ff, #dbeafe);
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.15s;
  border: 2px dashed #93c5fd;
}

.scan-box:active {
  transform: scale(0.97);
}

.scan-text {
  font-size: 16px;
  font-weight: 600;
  color: #1677ff;
  margin: 0;
}

.scan-hint {
  font-size: 12px;
  color: var(--eis-text-secondary);
  margin: 0;
}

.manual-section,
.warehouse-section,
.recent-section {
  margin-top: 16px;
}
</style>
