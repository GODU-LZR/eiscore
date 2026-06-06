<template>
  <div class="inventory-page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <h2>库存总览</h2>
      <div class="header-actions">
        <button class="btn-refresh" :disabled="loading" @click="fetchAll">刷新</button>
      </div>
    </header>

    <!-- 统计卡片 -->
    <section class="stats-row">
      <div class="stat-card">
        <div class="stat-label">当前库存条目</div>
        <div class="stat-value">{{ filteredList.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">仓库数量</div>
        <div class="stat-value">{{ warehouses.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">涉及物料</div>
        <div class="stat-value">{{ materialCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">库存总量</div>
        <div class="stat-value">{{ totalQty }}</div>
      </div>
    </section>

    <!-- 筛选栏 -->
    <section class="filter-bar">
      <div class="filter-item">
        <label>仓库</label>
        <select v-model="filters.warehouseId">
          <option value="">全部仓库</option>
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>
      <div class="filter-item">
        <label>物料</label>
        <input v-model="filters.materialKeyword" type="text" placeholder="物料编码/名称搜索" />
      </div>
      <div class="filter-item">
        <label>批次</label>
        <input v-model="filters.batchNo" type="text" placeholder="批次号" />
      </div>
      <button class="btn-clear" @click="clearFilters">清除筛选</button>
    </section>

    <!-- 加载状态 -->
    <div v-if="loading" class="state-box">
      <span class="spinner"></span>
      <p>正在加载库存数据...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="errorMsg" class="state-box error">
      <p>{{ errorMsg }}</p>
      <button class="btn-retry" @click="fetchAll">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="inventoryList.length === 0 && !loading" class="state-box">
      <p>暂无库存数据</p>
    </div>

    <!-- 数据表格 -->
    <section v-else class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>物料编码</th>
            <th>物料名称</th>
            <th>规格</th>
            <th>仓库</th>
            <th>批次号</th>
            <th class="col-num">当前库存</th>
            <th class="col-num">可用库存</th>
            <th>单位</th>
            <th>最后更新</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in filteredList" :key="row.id || idx">
            <td><code>{{ row.material_code || '-' }}</code></td>
            <td>{{ row.material_name || row.materialName || '-' }}</td>
            <td>{{ row.spec || '-' }}</td>
            <td>{{ row.warehouse_name || row.warehouseName || '-' }}</td>
            <td>{{ row.batch_no || row.batchNo || '-' }}</td>
            <td class="col-num">{{ row.current_qty ?? row.currentQty ?? 0 }}</td>
            <td class="col-num">{{ row.available_qty ?? row.availableQty ?? 0 }}</td>
            <td>{{ row.unit || '-' }}</td>
            <td class="col-date">{{ formatTime(row.updated_at || row.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script>
function callTool(toolId, args) {
  if (typeof window !== 'undefined' && window.EISFlash && window.EISFlash.callTool) {
    return window.EISFlash.callTool(toolId, args);
  }
  throw new Error('EISFlash 工具桥不可用');
}

export default {
  name: 'InventoryView',
  data() {
    return {
      loading: false,
      errorMsg: '',
      inventoryList: [],
      warehouses: [],
      materials: [],
      filters: {
        warehouseId: '',
        materialKeyword: '',
        batchNo: ''
      }
    };
  },
  computed: {
    filteredList() {
      let list = this.inventoryList;
      if (this.filters.warehouseId) {
        list = list.filter(
          r => (r.warehouse_id || r.warehouseId) === this.filters.warehouseId
        );
      }
      if (this.filters.materialKeyword) {
        const kw = this.filters.materialKeyword.toLowerCase();
        list = list.filter(
          r =>
            (r.material_code || '').toLowerCase().includes(kw) ||
            (r.material_name || r.materialName || '').toLowerCase().includes(kw)
        );
      }
      if (this.filters.batchNo) {
        const bn = this.filters.batchNo.toLowerCase();
        list = list.filter(r => (r.batch_no || r.batchNo || '').toLowerCase().includes(bn));
      }
      return list;
    },
    totalQty() {
      return this.filteredList.reduce((sum, r) => sum + Number(r.current_qty ?? r.currentQty ?? 0), 0);
    },
    materialCount() {
      const codes = new Set(
        this.inventoryList.map(r => r.material_code || r.materialCode).filter(Boolean)
      );
      return codes.size;
    }
  },
  mounted() {
    this.fetchAll();
  },
  methods: {
    async fetchAll() {
      this.loading = true;
      this.errorMsg = '';
      try {
        const [invResult, whResult] = await Promise.all([
          callTool('flash.inventory.current.list', {}),
          callTool('flash.warehouse.list', {})
        ]);
        this.inventoryList = Array.isArray(invResult) ? invResult : (invResult?.data || invResult?.list || []);
        this.warehouses = Array.isArray(whResult) ? whResult : (whResult?.data || whResult?.list || []);
      } catch (e) {
        this.errorMsg = e.message || '加载数据失败';
      } finally {
        this.loading = false;
      }
    },
    clearFilters() {
      this.filters = { warehouseId: '', materialKeyword: '', batchNo: '' };
    },
    formatTime(val) {
      if (!val) return '-';
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
};
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }
.inventory-page {
  min-height: 100vh;
  padding: 24px 32px;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #f1f5f9;
  color: #0f172a;
}

/* 头部 */
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.page-header h2 { font-size: 24px; font-weight: 700; }
.header-actions { display: flex; gap: 8px; }
.btn-refresh {
  padding: 8px 18px; border: none; border-radius: 8px;
  background: #2563eb; color: #fff; font-size: 14px; cursor: pointer;
}
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-refresh:hover:not(:disabled) { background: #1d4ed8; }

/* 卡片 */
.stats-row { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 140px; padding: 20px; border-radius: 12px;
  background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.stat-label { font-size: 13px; color: #64748b; margin-bottom: 6px; }
.stat-value { font-size: 28px; font-weight: 700; color: #0f172a; }

/* 筛选栏 */
.filter-bar {
  display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
  margin-bottom: 16px; padding: 16px; background: #fff;
  border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-item label { font-size: 12px; color: #64748b; font-weight: 600; }
.filter-item select, .filter-item input {
  padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px;
  font-size: 13px; min-width: 160px; outline: none;
}
.filter-item select:focus, .filter-item input:focus { border-color: #2563eb; }
.btn-clear {
  padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
  background: #fff; color: #475569; font-size: 13px; cursor: pointer;
  height: 34px;
}
.btn-clear:hover { background: #f1f5f9; }

/* 状态 */
.state-box {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 48px 24px; color: #64748b; font-size: 15px;
}
.state-box.error { color: #dc2626; }
.spinner {
  width: 28px; height: 28px; border: 3px solid #e2e8f0;
  border-top-color: #2563eb; border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-retry {
  padding: 7px 16px; border: none; border-radius: 8px;
  background: #2563eb; color: #fff; font-size: 13px; cursor: pointer;
}

/* 表格 */
.table-wrapper {
  background: #fff; border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); overflow-x: auto;
}
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th {
  text-align: left; padding: 12px 14px; background: #f8fafc;
  font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.col-num { text-align: right; }
tbody td {
  padding: 10px 14px; border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}
tbody tr:hover { background: #f8fafc; }
code { font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.col-date { color: #64748b; font-size: 12px; }
</style>