<template>
  <div class="flash-draft-page">
    <section class="hero">
      <div class="hero-badge">PDA出入库系统</div>
      <h1>PDA库存管理系统</h1>
      <p>使用PDA设备进行快速出入库操作，支持扫码录入和批量处理</p>
    </section>

    <div class="container">
      <!-- 操作模式选择 -->
      <div class="mode-selector">
        <button
          class="mode-btn"
          :class="{ active: currentMode === 'inbound' }"
          @click="currentMode = 'inbound'"
        >
          入库操作
        </button>
        <button
          class="mode-btn"
          :class="{ active: currentMode === 'outbound' }"
          @click="currentMode = 'outbound'"
        >
          出库操作
        </button>
      </div>

      <!-- 入库表单 -->
      <div v-if="currentMode === 'inbound'" class="form-container">
        <h2>入库操作</h2>
        <div class="form-group">
          <label>物料编码</label>
          <input
            type="text"
            v-model="inboundForm.materialCode"
            placeholder="扫描或输入物料编码"
            @keyup.enter="searchMaterial"
          >
        </div>
        <div class="form-group">
          <label>物料名称</label>
          <input
            type="text"
            v-model="inboundForm.materialName"
            placeholder="自动获取"
            readonly
          >
        </div>
        <div class="form-group">
          <label>仓库</label>
          <select v-model="inboundForm.warehouseId">
            <option value="">选择仓库</option>
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>数量</label>
          <input
            type="number"
            v-model="inboundForm.quantity"
            placeholder="输入数量"
            min="1"
          >
        </div>
        <div class="form-group">
          <label>批次号</label>
          <input
            type="text"
            v-model="inboundForm.batchNo"
            placeholder="自动生成"
            readonly
          >
          <button @click="generateBatchNo" class="batch-btn">生成批次号</button>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea
            v-model="inboundForm.remarks"
            placeholder="输入备注信息"
            rows="3"
          ></textarea>
        </div>
        <button @click="performInbound" class="submit-btn">确认入库</button>
      </div>

      <!-- 出库表单 -->
      <div v-if="currentMode === 'outbound'" class="form-container">
        <h2>出库操作</h2>
        <div class="form-group">
          <label>物料编码</label>
          <input
            type="text"
            v-model="outboundForm.materialCode"
            placeholder="扫描或输入物料编码"
            @keyup.enter="searchMaterial"
          >
        </div>
        <div class="form-group">
          <label>物料名称</label>
          <input
            type="text"
            v-model="outboundForm.materialName"
            placeholder="自动获取"
            readonly
          >
        </div>
        <div class="form-group">
          <label>仓库</label>
          <select v-model="outboundForm.warehouseId">
            <option value="">选择仓库</option>
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>数量</label>
          <input
            type="number"
            v-model="outboundForm.quantity"
            placeholder="输入数量"
            min="1"
          >
        </div>
        <div class="form-group">
          <label>出库单号</label>
          <input
            type="text"
            v-model="outboundForm.outboundOrder"
            placeholder="输入出库单号"
          >
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea
            v-model="outboundForm.remarks"
            placeholder="输入备注信息"
            rows="3"
          ></textarea>
        </div>
        <button @click="performOutbound" class="submit-btn">确认出库</button>
      </div>

      <!-- 操作记录 -->
      <div class="history-section">
        <h2>最近操作记录</h2>
        <div class="history-list">
          <div v-for="(record, index) in operationHistory" :key="index" class="history-item">
            <div class="record-header">
              <span class="record-type">{{ record.type }}</span>
              <span class="record-time">{{ record.time }}</span>
            </div>
            <div class="record-details">
              <span>{{ record.materialName }} - {{ record.quantity }} {{ record.unit }}</span>
              <span class="record-warehouse">{{ record.warehouse }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'FlashDraft',
  setup() {
    const currentMode = ref('inbound')
    const warehouses = ref([])
    const operationHistory = ref([])

    // 表单数据
    const inboundForm = ref({
      materialCode: '',
      materialName: '',
      warehouseId: '',
      quantity: '',
      batchNo: '',
      remarks: ''
    })

    const outboundForm = ref({
      materialCode: '',
      materialName: '',
      warehouseId: '',
      quantity: '',
      outboundOrder: '',
      remarks: ''
    })

    // 初始化仓库数据
    const initWarehouses = async () => {
      try {
        const response = await window.flashSemanticTool('flash.warehouse.list', {})
        warehouses.value = response.data || []
      } catch (error) {
        console.error('获取仓库列表失败:', error)
      }
    }

    // 搜索物料信息
    const searchMaterial = async () => {
      const materialCode = currentMode.value === 'inbound' ? inboundForm.value.materialCode : outboundForm.value.materialCode
      if (!materialCode) return

      try {
        const response = await window.flashSemanticTool('flash.material.master.list', {
          params: { code: materialCode }
        })
        const material = response.data?.[0]
        if (material) {
          if (currentMode.value === 'inbound') {
            inboundForm.value.materialName = material.name
          } else {
            outboundForm.value.materialName = material.name
          }
        }
      } catch (error) {
        console.error('获取物料信息失败:', error)
      }
    }

    // 生成批次号
    const generateBatchNo = async () => {
      try {
        const response = await window.flashSemanticTool('flash.inventory.batchno.generate', {})
        inboundForm.value.batchNo = response.data?.batchNo || 'BATCH' + Date.now()
      } catch (error) {
        console.error('生成批次号失败:', error)
        inboundForm.value.batchNo = 'BATCH' + Date.now()
      }
    }

    // 执行入库操作
    const performInbound = async () => {
      if (!validateInboundForm()) return

      try {
        const payload = {
          material_code: inboundForm.value.materialCode,
          warehouse_id: inboundForm.value.warehouseId,
          quantity: parseInt(inboundForm.value.quantity),
          batch_no: inboundForm.value.batchNo,
          remarks: inboundForm.value.remarks
        }

        await window.flashSemanticTool('flash.inventory.stock.in', {
          payload,
          confirm: true
        })

        addToHistory('入库', inboundForm.value.materialName, inboundForm.value.quantity, '个', warehouses.value.find(w => w.id === inboundForm.value.warehouseId)?.name)
        resetInboundForm()
        alert('入库操作成功！')
      } catch (error) {
        console.error('入库操作失败:', error)
        alert('入库操作失败，请重试')
      }
    }

    // 执行出库操作
    const performOutbound = async () => {
      if (!validateOutboundForm()) return

      try {
        const payload = {
          material_code: outboundForm.value.materialCode,
          warehouse_id: outboundForm.value.warehouseId,
          quantity: parseInt(outboundForm.value.quantity),
          outbound_order: outboundForm.value.outboundOrder,
          remarks: outboundForm.value.remarks
        }

        await window.flashSemanticTool('flash.inventory.stock.out', {
          payload,
          confirm: true
        })

        addToHistory('出库', outboundForm.value.materialName, outboundForm.value.quantity, '个', warehouses.value.find(w => w.id === outboundForm.value.warehouseId)?.name)
        resetOutboundForm()
        alert('出库操作成功！')
      } catch (error) {
        console.error('出库操作失败:', error)
        alert('出库操作失败，请重试')
      }
    }

    // 验证入库表单
    const validateInboundForm = () => {
      if (!inboundForm.value.materialCode) {
        alert('请输入物料编码')
        return false
      }
      if (!inboundForm.value.materialName) {
        alert('请获取物料信息')
        return false
      }
      if (!inboundForm.value.warehouseId) {
        alert('请选择仓库')
        return false
      }
      if (!inboundForm.value.quantity || parseInt(inboundForm.value.quantity) <= 0) {
        alert('请输入有效数量')
        return false
      }
      if (!inboundForm.value.batchNo) {
        alert('请生成批次号')
        return false
      }
      return true
    }

    // 验证出库表单
    const validateOutboundForm = () => {
      if (!outboundForm.value.materialCode) {
        alert('请输入物料编码')
        return false
      }
      if (!outboundForm.value.materialName) {
        alert('请获取物料信息')
        return false
      }
      if (!outboundForm.value.warehouseId) {
        alert('请选择仓库')
        return false
      }
      if (!outboundForm.value.quantity || parseInt(outboundForm.value.quantity) <= 0) {
        alert('请输入有效数量')
        return false
      }
      if (!outboundForm.value.outboundOrder) {
        alert('请输入出库单号')
        return false
      }
      return true
    }

    // 添加到操作历史
    const addToHistory = (type, materialName, quantity, unit, warehouse) => {
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

      operationHistory.value.unshift({
        type,
        materialName,
        quantity,
        unit,
        warehouse,
        time: timeStr
      })

      // 保持最多10条记录
      if (operationHistory.value.length > 10) {
        operationHistory.value.pop()
      }
    }

    // 重置入库表单
    const resetInboundForm = () => {
      inboundForm.value = {
        materialCode: '',
        materialName: '',
        warehouseId: '',
        quantity: '',
        batchNo: '',
        remarks: ''
      }
    }

    // 重置出库表单
    const resetOutboundForm = () => {
      outboundForm.value = {
        materialCode: '',
        materialName: '',
        warehouseId: '',
        quantity: '',
        outboundOrder: '',
        remarks: ''
      }
    }

    onMounted(() => {
      initWarehouses()
    })

    return {
      currentMode,
      warehouses,
      operationHistory,
      inboundForm,
      outboundForm,
      searchMaterial,
      generateBatchNo,
      performInbound,
      performOutbound
    }
  }
}
</script>

<style scoped>
.flash-draft-page { min-height: 100vh; padding: 36px; color: #0f172a; background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%); font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.hero { max-width: 860px; margin: 0 auto; padding: 34px 30px; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 20px; background: rgba(255, 255, 255, 0.78); box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08); }
.hero-badge { width: fit-content; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #1d4ed8; background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.22); }
.hero h1 { margin: 14px 0 10px; font-size: 38px; line-height: 1.15; }
.hero p { margin: 0; font-size: 17px; color: #475569; }

.container { max-width: 860px; margin: 30px auto; }
.mode-selector { display: flex; gap: 20px; margin-bottom: 30px; }
.mode-btn { padding: 12px 24px; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer; font-size: 16px; transition: all 0.3s; }
.mode-btn:hover { background: #f3f4f6; }
.mode-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }

.form-container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); margin-bottom: 30px; }
.form-container h2 { margin-top: 0; margin-bottom: 24px; color: #1f2937; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #374151; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
.form-group textarea { resize: vertical; min-height: 80px; }
.batch-btn { margin-left: 10px; padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; }
.submit-btn { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; margin-top: 10px; }
.submit-btn:hover { background: #2563eb; }

.history-section { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
.history-section h2 { margin-top: 0; margin-bottom: 20px; color: #1f2937; }
.history-list { max-height: 300px; overflow-y: auto; }
.history-item { padding: 16px; border-bottom: 1px solid #f3f4f6; }
.history-item:last-child { border-bottom: none; }
.record-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.record-type { font-weight: 500; color: #374151; }
.record-time { color: #6b7280; font-size: 14px; }
.record-details { display: flex; justify-content: space-between; }
.record-warehouse { color: #6b7280; font-size: 14px; }
</style>
