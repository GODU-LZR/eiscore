<template>
  <div class="pda-root">
    <!-- 顶部栏 -->
    <header class="pda-header">
      <div class="header-left">
        <span class="icon-warehouse">🏭</span>
        <select v-model="selectedWarehouseId" class="warehouse-select" @change="onWarehouseChange">
          <option value="">选择仓库</option>
          <option v-for="wh in warehouseList" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
        </select>
      </div>
      <div class="header-right">
        <span class="badge">{{ modeLabel }}</span>
      </div>
    </header>

    <!-- 模式切换 -->
    <nav class="mode-tabs">
      <button :class="['tab', { active: mode === 'in' }]" @click="switchMode('in')">
        📥 入库
      </button>
      <button :class="['tab', { active: mode === 'out' }]" @click="switchMode('out')">
        📤 出库
      </button>
    </nav>

    <!-- 扫码输入区 -->
    <section class="scan-area">
      <div class="scan-input-row">
        <input
          ref="scanInput"
          v-model="scanCode"
          class="scan-input"
          :placeholder="mode === 'in' ? '扫描/输入物料条码...' : '扫描/输入物料条码...'"
          @keyup.enter="onScanConfirm"
        />
        <button class="btn-scan" @click="onScanConfirm">🔍</button>
      </div>
      <div v-if="scanError" class="scan-error">{{ scanError }}</div>
    </section>

    <!-- 明细列表 -->
    <section class="detail-section">
      <div class="detail-header">
        <h3>本次{{ mode === 'in' ? '入库' : '出库' }}明细</h3>
        <span class="count">{{ detailList.length }} 项</span>
      </div>

      <div v-if="detailList.length === 0" class="empty-hint">
        暂无记录，请扫描或输入物料
      </div>

      <ul v-else class="detail-list">
        <li v-for="(item, idx) in detailList" :key="idx" class="detail-item">
          <div class="item-main">
            <span class="item-code">{{ item.material_code || item.material_id }}</span>
            <span class="item-name">{{ item.material_name || '--' }}</span>
          </div>
          <div class="item-meta">
            <span class="item-batch" v-if="item.batch_no">批次: {{ item.batch_no }}</span>
            <span class="item-qty-label">数量</span>
            <input
              type="number"
              v-model.number="item.quantity"
              class="item-qty"
              min="1"
              @change="onQtyChange(idx)"
            />
            <span class="item-unit">{{ item.unit || 'pcs' }}</span>
            <button class="btn-del" @click="removeItem(idx)">✕</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 库存速览 -->
    <section class="inventory-preview" v-if="selectedWarehouseId && previewList.length > 0">
      <div class="preview-header">
        <h4>{{ selectedWarehouseName }} 库存概览</h4>
        <button class="btn-refresh" @click="loadInventoryPreview">🔄</button>
      </div>
      <ul class="preview-list">
        <li v-for="inv in previewList" :key="inv.id || inv.material_id" class="preview-item">
          <span class="pv-code">{{ inv.material_code || inv.material_id }}</span>
          <span class="pv-name">{{ inv.material_name || '--' }}</span>
          <span class="pv-stock">{{ inv.quantity || inv.stock_qty || 0 }} {{ inv.unit || 'pcs' }}</span>
        </li>
      </ul>
    </section>

    <!-- 底部操作栏 -->
    <footer class="pda-footer">
      <button class="btn-clear" :disabled="detailList.length === 0" @click="clearAll">清空</button>
      <button
        class="btn-submit"
        :disabled="detailList.length === 0 || submitting || !selectedWarehouseId"
        @click="onSubmit"
      >
        {{ submitting ? '提交中...' : (mode === 'in' ? '确认入库' : '确认出库') }}
      </button>
    </footer>

    <!-- 结果弹窗 -->
    <div v-if="resultMsg" class="toast" :class="resultOk ? 'toast-ok' : 'toast-err'">
      {{ resultMsg }}
      <button class="toast-close" @click="resultMsg = ''">✕</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FlashDraft',
  data() {
    return {
      mode: 'in',                     // 'in' | 'out'
      warehouseList: [],
      selectedWarehouseId: '',
      selectedWarehouseName: '',
      scanCode: '',
      scanError: '',
      detailList: [],
      previewList: [],
      submitting: false,
      resultMsg: '',
      resultOk: true,
      materialCache: new Map(),       // material_id -> material info
    };
  },
  computed: {
    modeLabel() {
      return this.mode === 'in' ? '入库模式' : '出库模式';
    },
  },
  async created() {
    await this.loadWarehouses();
  },
  mounted() {
    // 自动聚焦扫码输入
    this.$nextTick(() => {
      if (this.$refs.scanInput) this.$refs.scanInput.focus();
    });
  },
  methods: {
    /* ========= 工具桥封装 ========= */
    async callReadTool(toolId, args) {
      if (this.$flash && this.$flash.callTool) {
        return this.$flash.callTool(toolId, args);
      }
      if (window.EISFlash && window.EISFlash.callTool) {
        return window.EISFlash.callTool(toolId, args);
      }
      // fallback: 用 CLI 跑读工具
      const argsJson = JSON.stringify(args || {});
      const resp = await this.runCli(`node /app/flash-semantic-tool.js ${toolId} --args '${argsJson}'`);
      return JSON.parse(resp);
    },
    async callWriteTool(toolId, args) {
      if (this.$flash && this.$flash.callTool) {
        return this.$flash.callTool(toolId, args, { write: true });
      }
      if (window.EISFlash && window.EISFlash.callTool) {
        return window.EISFlash.callTool(toolId, args, { write: true });
      }
      const argsJson = JSON.stringify(args || {});
      const resp = await this.runCli(`node /app/flash-semantic-tool.js ${toolId} --args '${argsJson}' --confirm`);
      return JSON.parse(resp);
    },
    // CLI fallback (仅开发/兜底环境)
    runCli(cmd) {
      // 浏览器环境不可用 CLI；此处为 node 环境开发阶段兜底
      // 实际运行时由 $flash.callTool 接管
      return Promise.reject(new Error('CLI not available in browser'));
    },

    /* ========= 仓库 ========= */
    async loadWarehouses() {
      try {
        const res = await this.callReadTool('flash.warehouse.list', {});
        const list = Array.isArray(res) ? res : (res.data || res.rows || []);
        this.warehouseList = list.map(w => ({ id: w.id, name: w.name || w.warehouse_name || w.code }));
        if (this.warehouseList.length > 0 && !this.selectedWarehouseId) {
          this.selectedWarehouseId = this.warehouseList[0].id;
          this.selectedWarehouseName = this.warehouseList[0].name;
          await this.loadInventoryPreview();
        }
      } catch (e) {
        console.warn('load warehouses failed', e);
      }
    },
    async onWarehouseChange() {
      const wh = this.warehouseList.find(w => w.id === this.selectedWarehouseId);
      this.selectedWarehouseName = wh ? wh.name : '';
      await this.loadInventoryPreview();
    },

    /* ========= 库存速览 ========= */
    async loadInventoryPreview() {
      try {
        const res = await this.callReadTool('flash.inventory.current.list', {
          warehouse_id: this.selectedWarehouseId,
        });
        this.previewList = Array.isArray(res) ? res : (res.data || res.rows || []);
      } catch (e) {
        console.warn('load inventory preview failed', e);
        this.previewList = [];
      }
    },

    /* ========= 物料查询 ========= */
    async lookupMaterial(codeOrId) {
      // 先查缓存
      if (this.materialCache.has(codeOrId)) return this.materialCache.get(codeOrId);
      try {
        const res = await this.callReadTool('flash.material.master.list', {
          keyword: codeOrId,
          pageSize: 5,
        });
        const list = Array.isArray(res) ? res : (res.data || res.rows || []);
        if (list.length > 0) {
          const m = list[0];
          const info = {
            material_id: m.id,
            material_code: m.code || m.material_code,
            material_name: m.name || m.material_name,
            unit: m.unit || m.base_unit || 'pcs',
          };
          this.materialCache.set(codeOrId, info);
          // 也按 id 和 code 双重索引
          if (info.material_code) this.materialCache.set(info.material_code, info);
          if (info.material_id) this.materialCache.set(info.material_id, info);
          return info;
        }
      } catch (e) {
        console.warn('lookup material failed', e);
      }
      return null;
    },

    /* ========= 扫码 ========= */
    async onScanConfirm() {
      const raw = this.scanCode.trim();
      if (!raw) {
        this.scanError = '请输入物料条码';
        return;
      }
      this.scanError = '';
      const material = await this.lookupMaterial(raw);
      if (!material) {
        this.scanError = `未找到物料: ${raw}`;
        return;
      }
      // 检查是否已存在
      const exist = this.detailList.find(
        d => d.material_id === material.material_id || d.material_code === material.material_code
      );
      if (exist) {
        exist.quantity = (exist.quantity || 0) + 1;
      } else {
        this.detailList.push({
          material_id: material.material_id,
          material_code: material.material_code,
          material_name: material.material_name,
          unit: material.unit,
          batch_no: '',
          quantity: 1,
        });
      }
      this.scanCode = '';
      this.$nextTick(() => { if (this.$refs.scanInput) this.$refs.scanInput.focus(); });
    },

    onQtyChange(idx) {
      if (this.detailList[idx].quantity < 1) {
        this.detailList[idx].quantity = 1;
      }
    },
    removeItem(idx) {
      this.detailList.splice(idx, 1);
    },
    clearAll() {
      this.detailList = [];
    },

    /* ========= 模式 ========= */
    switchMode(m) {
      this.mode = m;
      this.resultMsg = '';
      this.$nextTick(() => { if (this.$refs.scanInput) this.$refs.scanInput.focus(); });
    },

    /* ========= 提交 ========= */
    async onSubmit() {
      if (!this.selectedWarehouseId) {
        this.showResult(false, '请先选择仓库');
        return;
      }
      if (this.detailList.length === 0) {
        this.showResult(false, '明细不能为空');
        return;
      }
      // 校验数量
      for (let i = 0; i < this.detailList.length; i++) {
        const d = this.detailList[i];
        if (!d.quantity || d.quantity <= 0) {
          this.showResult(false, `第${i + 1}项数量无效`);
          return;
        }
      }

      const toolId = this.mode === 'in' ? 'flash.inventory.stock.in' : 'flash.inventory.stock.out';
      const payload = {
        warehouse_id: this.selectedWarehouseId,
        items: this.detailList.map(d => ({
          material_id: d.material_id,
          material_code: d.material_code,
          quantity: d.quantity,
          unit: d.unit,
          batch_no: d.batch_no || undefined,
        })),
      };

      this.submitting = true;
      try {
        const res = await this.callWriteTool(toolId, payload);
        this.showResult(true, `${this.mode === 'in' ? '入库' : '出库'}成功！共 ${this.detailList.length} 项`);
        this.detailList = [];
        await this.loadInventoryPreview();
      } catch (e) {
        this.showResult(false, `操作失败: ${e.message || e}`);
      } finally {
        this.submitting = false;
      }
    },
    showResult(ok, msg) {
      this.resultOk = ok;
      this.resultMsg = msg;
      setTimeout(() => { this.resultMsg = ''; }, 4000);
    },
  },
};
</script>

<style scoped>
/* ====== PDA 整体风格 ====== */
.pda-root {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f0f2f5;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  display: flex;
  flex-direction: column;
  color: #1a1a2e;
  box-shadow: 0 0 30px rgba(0,0,0,.12);
  position: relative;
}

/* 顶部 */
.pda-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #1e3a5f, #2563eb);
  color: #fff;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.icon-warehouse { font-size: 20px; }
.warehouse-select {
  background: rgba(255,255,255,.15);
  border: 1px solid rgba(255,255,255,.25);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 14px;
  max-width: 180px;
}
.warehouse-select option { color: #1a1a2e; }
.badge {
  background: rgba(255,255,255,.18);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

/* 模式切换 */
.mode-tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}
.tab {
  flex: 1;
  padding: 14px 0;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all .2s;
  border-bottom: 3px solid transparent;
}
.tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

/* 扫码区 */
.scan-area { padding: 16px; background: #fff; }
.scan-input-row { display: flex; gap: 8px; }
.scan-input {
  flex: 1;
  padding: 14px 16px;
  font-size: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  outline: none;
  transition: border-color .2s;
}
.scan-input:focus { border-color: #2563eb; }
.btn-scan {
  width: 52px;
  border: none;
  background: #2563eb;
  color: #fff;
  font-size: 20px;
  border-radius: 10px;
  cursor: pointer;
}
.scan-error { color: #ef4444; font-size: 13px; margin-top: 6px; padding-left: 4px; }

/* 明细 */
.detail-section { flex: 1; overflow-y: auto; padding: 16px; background: #fff; margin-top: 8px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.detail-header h3 { margin: 0; font-size: 16px; }
.count { font-size: 13px; color: #64748b; }
.empty-hint { text-align: center; color: #94a3b8; padding: 32px 0; font-size: 14px; }

.detail-list { list-style: none; margin: 0; padding: 0; }
.detail-item { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; }
.item-main { display: flex; gap: 10px; margin-bottom: 6px; }
.item-code { font-weight: 700; font-size: 15px; color: #1e3a5f; }
.item-name { color: #475569; font-size: 14px; }
.item-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.item-batch { color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }
.item-qty-label { color: #94a3b8; }
.item-qty { width: 60px; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; font-size: 14px; }
.item-unit { color: #64748b; }
.btn-del { background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer; padding: 2px 6px; }

/* 库存速览 */
.inventory-preview { padding: 12px 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; max-height: 200px; overflow-y: auto; }
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.preview-header h4 { margin: 0; font-size: 14px; color: #475569; }
.btn-refresh { background: none; border: 1px solid #e2e8f0; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 14px; }
.preview-list { list-style: none; margin: 0; padding: 0; }
.preview-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
.pv-code { font-weight: 600; color: #1e3a5f; min-width: 80px; }
.pv-name { color: #475569; flex: 1; margin: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-stock { color: #2563eb; font-weight: 600; min-width: 60px; text-align: right; }

/* 底部 */
.pda-footer { display: flex; gap: 10px; padding: 14px 16px; background: #fff; border-top: 1px solid #e2e8f0; }
.btn-clear {
  flex: 1;
  padding: 14px 0;
  border: 2px solid #e2e8f0;
  background: #fff;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}
.btn-clear:disabled { opacity: .4; cursor: not-allowed; }
.btn-submit {
  flex: 2;
  padding: 14px 0;
  border: none;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.btn-submit:disabled { opacity: .5; cursor: not-allowed; }

/* Toast */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.toast-ok { background: #065f46; color: #d1fae5; }
.toast-err { background: #991b1b; color: #fecaca; }
.toast-close { background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; padding: 0; line-height: 1; }
</style>