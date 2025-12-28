<template>
  <div class="eis-document-paper">
    <div v-if="schema.title" class="doc-header">
      <h1 class="doc-title">{{ schema.title }}</h1>
      <div v-if="schema.docNo" class="doc-no">单据编号: {{ resolveValue(schema.docNo) || '自动生成' }}</div>
    </div>

    <div class="doc-body">
      <template v-for="(section, index) in schema.layout" :key="index">
        
        <div v-if="section.type === 'section'" class="doc-section">
          <div v-if="section.title" class="section-title">{{ section.title }}</div>
          <el-row class="grid-row">
            <el-col 
              v-for="(item, idx) in section.children" 
              :key="idx"
              :span="24 / (section.cols || 1)"
              class="grid-cell"
            >
              <div class="field-wrapper">
                <span v-if="item.label" class="field-label">{{ item.label }}:</span>
                
                <div class="field-content">
                  <span v-if="!item.widget || item.widget === 'text'">
                    {{ resolveValue(item.field, item.content) }}
                  </span>

                  <el-input 
                    v-else-if="item.widget === 'input'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    size="small"
                    :placeholder="item.placeholder"
                  />

                  <el-date-picker
                    v-else-if="item.widget === 'date'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    type="date"
                    size="small"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                  />

                  <el-input-number
                    v-else-if="item.widget === 'number'"
                    :model-value="resolveValue(item.field)"
                    @update:modelValue="(val) => updateValue(item.field, val)"
                    size="small"
                    controls-position="right"
                    style="width: 100%"
                  />
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div v-else-if="section.type === 'table'" class="doc-table-section">
          <div v-if="section.title" class="section-title">{{ section.title }}</div>
          <el-table 
            :data="resolveTableData(section.field)" 
            border 
            size="small" 
            style="width: 100%"
            class="custom-doc-table"
          >
            <el-table-column 
              v-for="(col, cIdx) in section.columns" 
              :key="cIdx"
              :prop="col.field"
              :label="col.label"
              :width="col.width"
              :align="col.align || 'center'"
            >
              <template #default="scope">
                <span>{{ scope.row[col.field] }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElRow, ElCol, ElInput, ElDatePicker, ElInputNumber, ElTable, ElTableColumn } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    default: () => ({})
  },
  schema: {
    type: Object,
    required: true,
    default: () => ({ layout: [] })
  }
})

const emit = defineEmits(['update:modelValue'])

/**
 * 核心：智能数据解析器
 * 1. 优先读取 root 层级 (e.g., data.name)
 * 2. 失败则读取 properties 层级 (e.g., data.properties.weight)
 * 3. 支持插值字符串 (e.g., "含税: {{ price }}")
 */
const resolveValue = (field, contentTemplate) => {
  // 如果是纯展示模板 (e.g., content: "审核人: {{ auditor }}")
  if (contentTemplate) {
    return contentTemplate.replace(/\{\{(.+?)\}\}/g, (_, key) => {
      return getValueByPath(key.trim()) || ''
    })
  }
  
  // 如果绑定了字段
  if (field) {
    return getValueByPath(field)
  }
  
  return ''
}

const getValueByPath = (path) => {
  if (!props.modelValue) return ''
  
  // 1. 尝试直接获取
  if (path in props.modelValue) {
    return props.modelValue[path]
  }
  
  // 2. 尝试从 properties 获取 (自动降级)
  if (props.modelValue.properties && path in props.modelValue.properties) {
    return props.modelValue.properties[path]
  }
  
  // 3. 支持点号访问深层对象 (e.g., "items.0.name") - 简易版
  const parts = path.split('.')
  if (parts.length > 1) {
    let current = props.modelValue
    for (const part of parts) {
      if (current === null || current === undefined) return ''
      current = current[part]
    }
    return current
  }

  return ''
}

/**
 * 获取表格数组数据
 * 通常明细表数据存储在 properties.items 或者关联查询的子字段中
 */
const resolveTableData = (field) => {
  const data = getValueByPath(field)
  return Array.isArray(data) ? data : []
}

/**
 * 数据更新回写
 * 同样需要处理 root 和 properties 的区别
 */
const updateValue = (field, value) => {
  const newData = JSON.parse(JSON.stringify(props.modelValue))
  
  // 简单判断：如果 key 存在于 root，就更 root；否则更 properties
  // 注意：这只是一个简化的逻辑，生产环境可能需要更严谨的 schema 定义字段位置
  if (field in newData) {
    newData[field] = value
  } else {
    if (!newData.properties) newData.properties = {}
    newData.properties[field] = value
  }
  
  emit('update:modelValue', newData)
}
</script>

<style scoped>
.eis-document-paper {
  background: #fff;
  padding: 20px 40px;
  border: 1px solid #dcdfe6;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  max-width: 900px;
  margin: 0 auto;
  font-family: "SimSun", "Songti SC", serif; /* 仿宋/宋体，更像凭证 */
  color: #000;
}

/* 标题区 */
.doc-header {
  text-align: center;
  margin-bottom: 20px;
  position: relative;
}
.doc-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #000;
  display: inline-block;
}
.doc-no {
  position: absolute;
  right: 0;
  top: 5px;
  font-size: 12px;
  font-family: sans-serif;
}

/* 栅格边框模拟 */
.grid-row {
  border-top: 1px solid #000;
  border-left: 1px solid #000;
}
.grid-cell {
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
}

/* 字段样式 */
.field-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}
.field-label {
  font-weight: bold;
  margin-right: 8px;
  white-space: nowrap;
  font-size: 14px;
}
.field-content {
  flex: 1;
  font-size: 14px;
}

/* 表格区域 */
.doc-table-section {
  margin-top: -1px; /* 边框重叠 */
}
.section-title {
  font-weight: bold;
  padding: 5px 0;
  border-bottom: 1px solid #000;
}

/* 覆盖 Element 样式以适应打印风格 */
:deep(.el-input__wrapper) {
  box-shadow: none !important;
  border-bottom: 1px dashed #999;
  border-radius: 0;
  padding: 0;
  background: transparent;
}
:deep(.el-input__inner) {
  text-align: left;
  color: #000;
}
:deep(.custom-doc-table) {
  --el-table-border-color: #000;
  --el-table-header-bg-color: #f5f5f5;
  --el-table-text-color: #000;
  border: 1px solid #000;
  border-bottom: none; /* 避免双重底边 */
}
:deep(.custom-doc-table th.el-table__cell) {
  font-weight: bold;
  color: #000;
  border-bottom: 1px solid #000 !important;
  border-right: 1px solid #000 !important;
}
:deep(.custom-doc-table td.el-table__cell) {
  border-bottom: 1px solid #000 !important;
  border-right: 1px solid #000 !important;
}
</style>