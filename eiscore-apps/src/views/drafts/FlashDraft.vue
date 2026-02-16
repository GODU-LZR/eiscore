<template>
  <div class="cost-calculation">
    <header class="calculation-header">
      <div class="header-content">
        <h1>成本核算系统</h1>
        <p>精准计算成本，优化资源配置</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="calculateCost">计算成本</el-button>
        <el-button type="success" @click="exportReport">导出报表</el-button>
        <el-button type="info" @click="resetForm">重置</el-button>
      </div>
    </header>

    <div class="calculation-content">
      <!-- 成本输入表单 -->
      <el-card class="input-card" shadow="never">
        <template #header>
          <div class="card-title">成本输入</div>
        </template>
        
        <div class="input-form">
          <el-form :model="costForm" label-width="120px">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="产品名称">
                  <el-input v-model="costForm.productName" placeholder="请输入产品名称" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="生产数量">
                  <el-input-number v-model="costForm.quantity" :min="1" placeholder="请输入数量" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="单位">
                  <el-input v-model="costForm.unit" placeholder="请输入单位" />
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="原材料成本">
                  <el-input-number v-model="costForm.materialCost" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="人工成本">
                  <el-input-number v-model="costForm.laborCost" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="制造费用">
                  <el-input-number v-model="costForm.manufacturingCost" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="管理费用">
                  <el-input-number v-model="costForm.managementCost" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="销售费用">
                  <el-input-number v-model="costForm.salesCost" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="其他费用">
                  <el-input-number v-model="costForm.otherCost" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="目标利润率">
                  <el-input-number v-model="costForm.targetProfitRate" :precision="2" :step="0.1" placeholder="%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目标售价">
                  <el-input-number v-model="costForm.targetPrice" :precision="2" :step="0.01" placeholder="元" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </div>
      </el-card>

      <!-- 成本分析卡片 -->
      <div class="analysis-cards">
        <el-card class="analysis-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon">
              <i class="el-icon-money"></i>
            </div>
            <div class="card-info">
              <div class="card-value">{{ formatCurrency(totalCost) }}</div>
              <div class="card-label">总成本</div>
            </div>
          </div>
        </el-card>
        
        <el-card class="analysis-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon">
              <i class="el-icon-discount"></i>
            </div>
            <div class="card-info">
              <div class="card-value">{{ formatCurrency(unitCost) }}</div>
              <div class="card-label">单位成本</div>
            </div>
          </div>
        </el-card>
        
        <el-card class="analysis-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon">
              <i class="el-icon-percent"></i>
            </div>
            <div class="card-info">
              <div class="card-value">{{ formatPercentage(profitRate) }}</div>
              <div class="card-label">利润率</div>
            </div>
          </div>
        </el-card>
        
        <el-card class="analysis-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon">
              <i class="el-icon-tickets"></i>
            </div>
            <div class="card-info">
              <div class="card-value">{{ formatCurrency(targetPrice) }}</div>
              <div class="card-label">建议售价</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 成本明细表格 -->
      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-title">成本明细</div>
        </template>
        
        <div class="detail-table">
          <el-table :data="costDetails" style="width: 100%" border>
            <el-table-column prop="category" label="成本类别" width="120" />
            <el-table-column prop="amount" label="金额(元)" width="150">
              <template #default="scope">
                {{ formatCurrency(scope.row.amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="percentage" label="占比" width="100">
              <template #default="scope">
                {{ formatPercentage(scope.row.percentage) }}
              </template>
            </el-table-column>
            <el-table-column prop="unitCost" label="单位成本(元)" width="150">
              <template #default="scope">
                {{ formatCurrency(scope.row.unitCost) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>

      <!-- 成本趋势图表 -->
      <el-card class="chart-card" shadow="never">
        <template #header>
          <div class="card-title">成本趋势分析</div>
        </template>
        
        <div class="chart-content">
          <div ref="chart" style="width: 100%; height: 300px;"></div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'

// 成本表单数据
const costForm = ref({
  productName: '',
  quantity: 1,
  unit: '',
  materialCost: 0,
  laborCost: 0,
  manufacturingCost: 0,
  managementCost: 0,
  salesCost: 0,
  otherCost: 0,
  targetProfitRate: 20,
  targetPrice: 0
})

// 计算结果
const totalCost = ref(0)
const unitCost = ref(0)
const profitRate = ref(0)
const targetPrice = ref(0)
const costDetails = ref([])

// 图表实例
const chart = ref(null)

// 计算成本
const calculateCost = () => {
  // 计算总成本
  totalCost.value = costForm.value.materialCost + 
                   costForm.value.laborCost + 
                   costForm.value.manufacturingCost + 
                   costForm.value.managementCost + 
                   costForm.value.salesCost + 
                   costForm.value.otherCost
  
  // 计算单位成本
  unitCost.value = totalCost.value / costForm.value.quantity
  
  // 计算建议售价
  targetPrice.value = unitCost.value * (1 + costForm.value.targetProfitRate / 100)
  
  // 计算实际利润率
  if (costForm.value.targetPrice > 0) {
    profitRate.value = ((costForm.value.targetPrice - unitCost.value) / costForm.value.targetPrice) * 100
  } else {
    profitRate.value = costForm.value.targetProfitRate
  }
  
  // 生成成本明细
  costDetails.value = [
    {
      category: '原材料成本',
      amount: costForm.value.materialCost,
      percentage: (costForm.value.materialCost / totalCost.value) * 100,
      unitCost: costForm.value.materialCost / costForm.value.quantity
    },
    {
      category: '人工成本',
      amount: costForm.value.laborCost,
      percentage: (costForm.value.laborCost / totalCost.value) * 100,
      unitCost: costForm.value.laborCost / costForm.value.quantity
    },
    {
      category: '制造费用',
      amount: costForm.value.manufacturingCost,
      percentage: (costForm.value.manufacturingCost / totalCost.value) * 100,
      unitCost: costForm.value.manufacturingCost / costForm.value.quantity
    },
    {
      category: '管理费用',
      amount: costForm.value.managementCost,
      percentage: (costForm.value.managementCost / totalCost.value) * 100,
      unitCost: costForm.value.managementCost / costForm.value.quantity
    },
    {
      category: '销售费用',
      amount: costForm.value.salesCost,
      percentage: (costForm.value.salesCost / totalCost.value) * 100,
      unitCost: costForm.value.salesCost / costForm.value.quantity
    },
    {
      category: '其他费用',
      amount: costForm.value.otherCost,
      percentage: (costForm.value.otherCost / totalCost.value) * 100,
      unitCost: costForm.value.otherCost / costForm.value.quantity
    }
  ]
  
  // 初始化图表
  initChart()
}

// 初始化图表
const initChart = () => {
  if (chart.value) {
    const myChart = echarts.init(chart.value)
    
    const option = {
      title: {
        text: '成本构成分析',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '成本构成',
          type: 'pie',
          radius: '50%',
          data: costDetails.value.map(item => ({
            value: item.amount,
            name: item.category
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }
    
    myChart.setOption(option)
  }
}

// 重置表单
const resetForm = () => {
  costForm.value = {
    productName: '',
    quantity: 1,
    unit: '',
    materialCost: 0,
    laborCost: 0,
    manufacturingCost: 0,
    managementCost: 0,
    salesCost: 0,
    otherCost: 0,
    targetProfitRate: 20,
    targetPrice: 0
  }
  totalCost.value = 0
  unitCost.value = 0
  profitRate.value = 0
  targetPrice.value = 0
  costDetails.value = []
}

// 格式化货币
const formatCurrency = (value) => {
  return value.toFixed(2)
}

// 格式化百分比
const formatPercentage = (value) => {
  return value.toFixed(2) + '%'
}

// 导出报表
const exportReport = () => {
  console.log('导出成本报表')
}

// 组件挂载时初始化
onMounted(() => {
  calculateCost()
})
</script>

<style scoped>
.cost-calculation {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
}

.calculation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eaeaea;
}

.header-content h1 {
  margin: 0;
  font-size: 28px;
  color: #1f2937;
  font-weight: 600;
}

.header-content p {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.input-card, .detail-card, .chart-card {
  margin-bottom: 24px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}

.card-title {
  font-weight: 600;
  color: #1f2937;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-form {
  padding: 16px;
}

.analysis-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.analysis-card {
  transition: all 0.3s ease;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.analysis-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.card-content {
  display: flex;
  align-items: center;
  padding: 20px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  background: #f0f9ff;
}

.card-icon i {
  font-size: 24px;
  color: #3b82f6;
}

.card-info {
  flex: 1;
}

.card-value {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.card-label {
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0;
}

.detail-table {
  margin: 16px 0;
}

.chart-content {
  padding: 16px;
}
</style>

