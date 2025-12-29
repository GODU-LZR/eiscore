<template>
  <div class="home-container">
    <div class="welcome-section">
      <div class="text-content">
        <h2>早安，管理员！☀️</h2>
        <p class="subtitle">今天是 {{ currentDate }}，准备好开始一天的工作了吗？</p>
      </div>
      <img src="https://element-plus.org/images/element-plus-logo.svg" class="welcome-img" alt="welcome" />
    </div>

    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <template #header>
            <div class="card-header">
              <span>📦 物料总数</span>
              <el-tag type="success">实时</el-tag>
            </div>
          </template>
          <div class="card-value">12,580 <span class="unit">件</span></div>
          <div class="card-footer">
            较昨日 <span class="up">↑ 120</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <template #header>
            <div class="card-header">
              <span>👥 在职员工</span>
              <el-tag>人事</el-tag>
            </div>
          </template>
          <div class="card-value">386 <span class="unit">人</span></div>
          <div class="card-footer">
            本月入职 <span class="highlight">5</span> 人
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <template #header>
            <div class="card-header">
              <span>⚡ 待办事项</span>
              <el-tag type="danger">紧急</el-tag>
            </div>
          </template>
          <div class="card-value">12 <span class="unit">个</span></div>
          <div class="card-footer">
            需立即处理
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <template #header>
            <div class="card-header">
              <span>🔔 系统消息</span>
            </div>
          </template>
          <div class="card-value">3 <span class="unit">条</span></div>
          <div class="card-footer">
            系统运行正常
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="canViewEnterpriseAssistant" :gutter="20" class="assistant-row">
      <el-col :span="8">
        <el-card shadow="hover" class="assistant-card" @click="goEnterpriseAssistant">
          <div class="assistant-card-content">
            <div class="assistant-text">
              <div class="assistant-title">经营助手</div>
              <div class="assistant-subtitle">经营分析 / 经营报告</div>
            </div>
            <div class="assistant-icon">
              <el-icon><TrendCharts /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card shadow="never" class="action-card">
          <template #header>
            <span style="font-weight: bold">🚀 快捷入口</span>
          </template>
          <div class="quick-actions">
            <div class="action-item" @click="$router.push('/materials')">
              <div class="icon-box bg-blue"><el-icon><Box /></el-icon></div>
              <span>物料入库</span>
            </div>
            <div class="action-item" @click="$router.push('/materials')">
              <div class="icon-box bg-green"><el-icon><Search /></el-icon></div>
              <span>库存查询</span>
            </div>
            <div class="action-item" @click="$router.push('/hr')">
              <div class="icon-box bg-orange"><el-icon><User /></el-icon></div>
              <span>员工录入</span>
            </div>
            <div class="action-item">
              <div class="icon-box bg-purple"><el-icon><Setting /></el-icon></div>
              <span>系统设置</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: bold">📢 系统公告</span>
          </template>
          <el-timeline>
            <el-timeline-item timestamp="2025-12-20" type="primary">
              系统完成微前端架构升级 (v2.0)
            </el-timeline-item>
            <el-timeline-item timestamp="2025-12-18" type="success">
              新增物料管理模块
            </el-timeline-item>
            <el-timeline-item timestamp="2025-12-15" type="info">
              年度库存盘点通知
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { TrendCharts } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs' // 如果没有装dayjs，可以用原生Date代替

const currentDate = ref('')
const router = useRouter()
const userStore = useUserStore()

const canViewEnterpriseAssistant = computed(() => {
  const role = String(userStore.userInfo?.role || '').toLowerCase()
  const permissions = userStore.userInfo?.permissions || []
  const managementRoles = new Set(['admin', 'manager', 'management', 'super'])
  return managementRoles.has(role) || permissions.includes('enterprise_assistant')
})

const goEnterpriseAssistant = () => {
  router.push('/ai/enterprise')
}

onMounted(() => {
  const now = new Date()
  currentDate.value = now.toLocaleDateString() + ' ' + (['周日','周一','周二','周三','周四','周五','周六'][now.getDay()])
})
</script>

<style scoped lang="scss">
.home-container {
  padding: 20px;
}

.welcome-section {
  background: linear-gradient(135deg, #ecf5ff 0%, #ffffff 100%);
  border-radius: 8px;
  padding: 30px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #d9ecff;

  .welcome-img {
    height: 100px;
    opacity: 0.8;
  }
}

.stat-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card-value {
    font-size: 28px;
    font-weight: bold;
    margin: 10px 0;
    .unit { font-size: 14px; font-weight: normal; color: #909399; }
  }
  .card-footer {
    font-size: 12px;
    color: #909399;
    .up { color: #f56c6c; font-weight: bold; }
    .highlight { color: #409eff; font-weight: bold; }
  }
}

.quick-actions {
  display: flex;
  gap: 20px;
  
  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover { transform: translateY(-5px); }
    
    .icon-box {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      margin-bottom: 8px;
      
      &.bg-blue { background: #409EFF; box-shadow: 0 4px 10px rgba(64,158,255,0.3); }
      &.bg-green { background: #67C23A; box-shadow: 0 4px 10px rgba(103,194,58,0.3); }
      &.bg-orange { background: #E6A23C; box-shadow: 0 4px 10px rgba(230,162,60,0.3); }
      &.bg-purple { background: #909399; box-shadow: 0 4px 10px rgba(144,147,153,0.3); }
    }
  }
}

.assistant-row {
  margin-top: 20px;
}

.assistant-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid #e4e7ed;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  }

  .assistant-card-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .assistant-title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }

  .assistant-subtitle {
    margin-top: 6px;
    font-size: 13px;
    color: #909399;
  }

  .assistant-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(64, 158, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #409eff;
    font-size: 22px;
  }
}
</style>
