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

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card shadow="never" class="enterprise-ai-card">
          <template #header>
            <span style="font-weight: bold">📈 企业经营 AI</span>
          </template>
          <div class="enterprise-ai-content">
            <div>
              <div class="enterprise-ai-title">经营分析与报告生成</div>
              <div class="enterprise-ai-desc">进入全屏经营助手，生成图表与经营报告。</div>
            </div>
            <el-button type="primary" @click="goEnterpriseAi">进入经营助手</el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="action-card" v-if="canHome">
          <template #header>
            <span style="font-weight: bold">🚀 快捷入口</span>
          </template>
          <div class="quick-actions">
            <div v-if="canMms" class="action-item" @click="$router.push('/materials')">
              <div class="icon-box bg-blue"><el-icon><Box /></el-icon></div>
              <span>物料入库</span>
            </div>
            <div v-if="canMms" class="action-item" @click="$router.push('/materials')">
              <div class="icon-box bg-green"><el-icon><Search /></el-icon></div>
              <span>库存查询</span>
            </div>
            <div v-if="canHr" class="action-item" @click="$router.push('/hr')">
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
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { hasPerm } from '@/utils/permission'

const currentDate = ref('')
const router = useRouter()
const canHome = computed(() => hasPerm('module:home'))
const canHr = computed(() => hasPerm('module:hr'))
const canMms = computed(() => hasPerm('module:mms'))

onMounted(() => {
  const now = new Date()
  currentDate.value = now.toLocaleDateString() + ' ' + (['周日','周一','周二','周三','周四','周五','周六'][now.getDay()])
})

const goEnterpriseAi = () => {
  router.push('/ai/enterprise')
}
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

.enterprise-ai-card {
  margin-bottom: 20px;
}

.enterprise-ai-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.enterprise-ai-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

.enterprise-ai-desc {
  font-size: 12px;
  color: #909399;
}
</style>
