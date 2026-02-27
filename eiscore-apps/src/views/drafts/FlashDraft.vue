<template>
  <div class="pda-material-inbound">
    <div class="header">
      <h1>PDA 物料入库</h1>
      <p>请填写入库信息</p>
    </div>

    <div class="form-container">
      <div class="form-group">
        <label>物料</label>
        <select v-model="formData.materialId" @change="handleMaterialChange">
          <option value="">请选择物料</option>
          <option v-for="material in materials" :key="material.id" :value="material.id">
            {{ material.name }} ({{ material.batch_no }})
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>仓库</label>
        <select v-model="formData.warehouseId">
          <option value="">请选择仓库</option>
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
            {{ warehouse.code }} - {{ warehouse.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>数量</label>
        <input 
          type="number" 
          v-model="formData.quantity" 
          placeholder="请输入数量"
          @input="handleQuantityInput"
        >
      </div>

      <div class="form-group">
        <label>单位</label>
        <input 
          type="text" 
          v-model="formData.unit" 
          placeholder="请输入单位"
          readonly
        >
      </div>

      <div class="form-group">
        <label>批次号</label>
        <div class="batch-no-container">
          <input 
            type="text" 
            v-model="formData.batchNo" 
            placeholder="请输入或生成批次号"
          >
          <button 
            @click="generateBatchNo" 
            :disabled="loading.generateBatchNo"
            class="generate-btn"
          >
            {{ loading.generateBatchNo ? '生成中...' : '生成批次号' }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>备注</label>
        <textarea 
          v-model="formData.remarks" 
          placeholder="请输入备注信息"
          rows="3"
        ></textarea>
      </div>

      <div class="button-group">
        <button 
          @click="saveDraft" 
          :disabled="loading.saveDraft || !isFormValid"
          class="save-btn"
        >
          {{ loading.saveDraft ? '保存中...' : '保存草稿' }}
        </button>
      </div>
    </div>

    <div class="draft-history">
      <h2>最近草稿记录</h2>
      <div v-if="loading.draftHistory" class="loading">加载中...</div>
      <div v-else-if="draftHistory.length === 0" class="empty">
        暂无草稿记录
      </div>
      <div v-else class="draft-list">
        <div 
          v-for="draft in draftHistory" 
          :key="draft.id" 
          class="draft-item"
          @click="loadDraft(draft)"
        >
          <div class="draft-header">
            <span class="material">{{ draft.material_name }}</span>
            <span class="warehouse">{{ draft.warehouse_code }}</span>
            <span class="quantity">{{ draft.quantity }} {{ draft.unit }}</span>
          </div>
          <div class="draft-footer">
            <span class="batch-no">{{ draft.batch_no }}</span>
            <span class="time">{{ formatTime(draft.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 成功提示 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'

export default {
  name: 'FlashDraft',
  setup() {
    const materials = ref([])
    const warehouses = ref([])
    const batchRules = ref([])
    const draftHistory = ref([])
    const error = ref('')
    const successMessage = ref('')
    const loading = ref({
      materials: false,
      warehouses: false,
      generateBatchNo: false,
      saveDraft: false,
      draftHistory: false
    })

    const formData = ref({
      materialId: '',
      warehouseId: '',
      quantity: '',
      unit: '',
      batchNo: '',
      remarks: ''
    })

    const resetMessages = () => {
      error.value = ''
      successMessage.value = ''
    }

    const showError = (message) => {
      error.value = String(message || '操作失败')
      successMessage.value = ''
    }

    const showSuccess = (message) => {
      successMessage.value = String(message || '操作成功')
      error.value = ''
      setTimeout(() => {
        if (successMessage.value === message) successMessage.value = ''
      }, 2200)
    }

    const readAuthToken = () => {
      const raw = localStorage.getItem('auth_token')
      if (!raw) return ''
      try {
        const parsed = JSON.parse(raw)
        return String(parsed?.token || '').trim() || String(raw).trim()
      } catch {
        return String(raw).trim()
      }
    }

    const parseJsonOrThrow = (text, label) => {
      try {
        return JSON.parse(String(text || 'null'))
      } catch {
        const snippet = String(text || '').replace(/\s+/g, ' ').slice(0, 140)
        throw new Error(`${label} 返回非JSON: ${snippet}`)
      }
    }

    const normalizeList = (payload) => {
      if (Array.isArray(payload)) return payload
      if (payload && Array.isArray(payload.items)) return payload.items
      if (payload && payload.data) return normalizeList(payload.data)
      return []
    }

    const requestApi = async ({ url, method = 'GET', profile = '', contentProfile = '', body = null, extraHeaders = {} }) => {
      const token = readAuthToken()
      const isWrite = method !== 'GET' && method !== 'HEAD'
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(profile ? { 'Accept-Profile': profile } : {}),
        ...extraHeaders
      }
      if (isWrite) {
        headers['Content-Type'] = 'application/json'
        if (contentProfile || profile) headers['Content-Profile'] = contentProfile || profile
      }

      const response = await fetch(`/api${url}`, {
        method,
        headers,
        body: isWrite && body ? JSON.stringify(body) : undefined
      })
      const text = await response.text()
      const payload = parseJsonOrThrow(text, url)
      if (!response.ok) {
        const message = payload?.message || payload?.code || `${method} ${url} 失败`
        throw new Error(message)
      }
      return payload
    }

    const callFlashTool = async (toolId, args = {}, confirmed = false) => {
      const token = readAuthToken()
      if (!token) throw new Error('缺少登录态，请重新登录')
      const payload = {
        tool_id: toolId,
        arguments: args,
        trace_id: `tr_${Date.now()}`
      }
      if (confirmed) {
        payload.confirmed = true
        payload.idempotency_key = `idem_${Date.now()}`
      }

      const response = await fetch('/agent/flash/tools/call', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      const text = await response.text()
      const result = parseJsonOrThrow(text, '/agent/flash/tools/call')
      if (!response.ok || result?.ok === false) {
        throw new Error(String(result?.message || result?.code || `tool call failed(${response.status})`))
      }
      return result
    }

    // 计算属性：表单是否有效
    const isFormValid = computed(() => {
      const qty = Number(formData.value.quantity)
      return formData.value.materialId &&
             formData.value.warehouseId &&
             Number.isFinite(qty) &&
             qty > 0 &&
             formData.value.batchNo
    })

    // 页面加载时获取数据
    onMounted(async () => {
      await Promise.allSettled([loadMaterials(), loadWarehouses(), loadBatchRules()])
      await loadDraftHistory()
    })

    // 加载物料列表
    const loadMaterials = async () => {
      loading.value.materials = true
      resetMessages()
      try {
        const data = await requestApi({
          url: '/raw_materials?select=id,batch_no,name&order=batch_no.asc',
          method: 'GET',
          profile: 'public'
        })
        materials.value = normalizeList(data)
      } catch (err) {
        showError(`加载物料列表失败: ${err.message}`)
      } finally {
        loading.value.materials = false
      }
    }

    // 加载仓库列表
    const loadWarehouses = async () => {
      loading.value.warehouses = true
      resetMessages()
      try {
        const data = await requestApi({
          url: '/warehouses?select=id,code,name,status&order=code.asc',
          method: 'GET',
          profile: 'scm'
        })
        warehouses.value = normalizeList(data).filter((item) => item?.status !== '停用')
      } catch (err) {
        showError(`加载仓库列表失败: ${err.message}`)
      } finally {
        loading.value.warehouses = false
      }
    }

    const loadBatchRules = async () => {
      try {
        const data = await requestApi({
          url: '/batch_no_rules?select=id,rule_name,status&order=created_at.desc&limit=20',
          method: 'GET',
          profile: 'scm'
        })
        batchRules.value = normalizeList(data).filter((item) => item?.status !== '停用')
      } catch {
        batchRules.value = []
      }
    }

    // 加载草稿历史
    const loadDraftHistory = async () => {
      loading.value.draftHistory = true
      resetMessages()
      try {
        const data = await requestApi({
          url: '/v_inventory_drafts?limit=10&order=created_at.desc',
          method: 'GET',
          profile: 'scm'
        })
        draftHistory.value = normalizeList(data)
      } catch (err) {
        showError(`加载草稿历史失败: ${err.message}`)
      } finally {
        loading.value.draftHistory = false
      }
    }

    // 处理物料选择变化
    const handleMaterialChange = () => {
      const material = materials.value.find((item) => String(item.id) === String(formData.value.materialId))
      if (material) {
        formData.value.unit = material.unit || formData.value.unit || '个'
      }
    }

    // 处理数量输入
    const handleQuantityInput = (e) => {
      const value = e.target.value
      if (value === '' || /^[\d.]+$/.test(value)) {
        formData.value.quantity = value
      }
    }

    // 生成批次号
    const generateBatchNo = async () => {
      if (loading.value.generateBatchNo) return
      loading.value.generateBatchNo = true
      resetMessages()

      try {
        const materialId = Number.parseInt(String(formData.value.materialId || ''), 10)
        if (!Number.isFinite(materialId) || materialId <= 0) {
          throw new Error('请先选择物料')
        }
        const ruleId = batchRules.value[0]?.id
        if (!ruleId) throw new Error('未找到可用批次规则')

        const result = await callFlashTool('flash.inventory.batchno.generate', {
          ruleId,
          materialId
        }, true)
        const batchNo = String(result?.data?.batch_no || '').trim()
        if (!batchNo) throw new Error('批次号为空')
        formData.value.batchNo = batchNo
      } catch (err) {
        formData.value.batchNo = `BATCH-${Date.now()}`
        showError(`批次号工具不可用，已使用本地批次号: ${err.message}`)
      } finally {
        loading.value.generateBatchNo = false
      }
    }

    // 保存草稿
    const saveDraft = async () => {
      if (!isFormValid.value) {
        showError('请填写所有必填字段')
        return
      }

      loading.value.saveDraft = true
      resetMessages()

      try {
        const payload = {
          draft_type: 'in',
          status: 'created',
          io_type: 'in',
          material_id: Number(formData.value.materialId),
          warehouse_id: String(formData.value.warehouseId),
          quantity: Number(formData.value.quantity),
          unit: String(formData.value.unit || '个').trim() || '个',
          batch_no: String(formData.value.batchNo || '').trim() || null,
          remark: String(formData.value.remarks || '').trim() || null
        }

        await requestApi({
          url: '/inventory_drafts',
          method: 'POST',
          profile: 'scm',
          contentProfile: 'scm',
          body: payload,
          extraHeaders: { Prefer: 'return=representation' }
        })

        showSuccess('草稿保存成功')
        formData.value = {
          materialId: '',
          warehouseId: '',
          quantity: '',
          unit: '',
          batchNo: '',
          remarks: ''
        }
        await loadDraftHistory()
      } catch (err) {
        showError(`保存草稿失败: ${err.message}`)
      } finally {
        loading.value.saveDraft = false
      }
    }

    // 加载草稿到表单
    const loadDraft = (draft) => {
      formData.value = {
        materialId: draft.material_id,
        warehouseId: draft.warehouse_id,
        quantity: draft.quantity != null ? String(draft.quantity) : '',
        unit: draft.unit || '',
        batchNo: draft.batch_no || '',
        remarks: draft.remark || ''
      }
    }

    // 格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return {
      formData,
      materials,
      warehouses,
      draftHistory,
      error,
      successMessage,
      loading,
      isFormValid,
      handleMaterialChange,
      handleQuantityInput,
      generateBatchNo,
      saveDraft,
      loadDraft,
      formatTime
    }
  }
}
</script>

<style scoped>
.pda-material-inbound {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  color: #1d4ed8;
  margin: 0;
  font-size: 24px;
}

.header p {
  color: #64748b;
  margin: 8px 0 0;
  font-size: 14px;
}

.form-container {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #334155;
  font-size: 14px;
}

.form-group select,
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.batch-no-container {
  display: flex;
  gap: 10px;
}

.batch-no-container input {
  flex: 1;
}

.generate-btn {
  padding: 10px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.generate-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.save-btn {
  padding: 12px 24px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
}

.save-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.draft-history {
  margin-top: 30px;
}

.draft-history h2 {
  font-size: 18px;
  margin-bottom: 16px;
  color: #334155;
}

.loading, .empty {
  text-align: center;
  padding: 20px;
  color: #64748b;
}

.draft-list {
  max-height: 300px;
  overflow-y: auto;
}

.draft-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.draft-item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.draft-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.draft-header .material {
  color: #1e40af;
  font-weight: 500;
}

.draft-header .warehouse {
  color: #059669;
}

.draft-header .quantity {
  color: #7c3aed;
  font-weight: 500;
}

.draft-footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
}

.draft-footer .batch-no {
  font-family: monospace;
}

.draft-footer .time {
  color: #94a3b8;
}

.error-message {
  background: #fee2e2;
  color: #dc2626;
  padding: 12px;
  border-radius: 6px;
  margin: 16px 0;
  font-size: 14px;
}

.success-message {
  background: #d1fae5;
  color: #059669;
  padding: 12px;
  border-radius: 6px;
  margin: 16px 0;
  font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .pda-material-inbound {
    padding: 10px;
  }
  
  .header h1 {
    font-size: 20px;
  }
  
  .form-container {
    padding: 15px;
  }
  
  .form-group label {
    font-size: 13px;
  }
  
  .form-group select,
  .form-group input,
  .form-group textarea {
    font-size: 13px;
    padding: 8px;
  }
  
  .generate-btn,
  .save-btn {
    font-size: 14px;
    padding: 10px 20px;
  }
}
</style>