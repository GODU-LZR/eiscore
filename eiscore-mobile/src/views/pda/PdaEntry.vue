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
          :title="rec.check_no || `盘点单 ${rec.id}`"
          :label="`盘点日期: ${formatDate(rec.check_date || rec.created_at)}${rec.total_items ? ` · ${rec.total_items} 项` : ''}`"
        >
          <template #value>
            <van-tag :type="isCompletedCheck(rec.status) ? 'success' : 'warning'">
              {{ isCompletedCheck(rec.status) ? '已完成' : (rec.status || '进行中') }}
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
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { navigateEnterprisePath } from '@eiscore/platform/navigation'
import { fetchPdaWarehouses, fetchRecentChecks } from '@/api/warehouse'

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
    warehouses.value = await fetchPdaWarehouses()
  } catch (e) {
    console.error('加载仓库失败:', e)
  } finally {
    warehouseLoading.value = false
  }
}

async function loadRecentRecords() {
  try {
    recentRecords.value = await fetchRecentChecks(5)
  } catch (e) {
    console.error('加载盘点记录失败:', e)
  }
}

function isCompletedCheck(status) {
  return ['completed', '已完成', '已生成调整单'].includes(String(status || '').trim())
}

function enterWarehouse(wh) {
  showToast({ message: `进入 ${wh.name}`, icon: 'logistics' })
  const result = navigateEnterprisePath(`/materials/inventory-check/warehouse/${wh.code}`, {
    tabTitle: `${wh.name}盘点`
  })
  if (!result.ok) {
    showToast(result.reason === 'module-disabled' ? '仓储模块未启用' : '无法进入该仓库')
  }
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
