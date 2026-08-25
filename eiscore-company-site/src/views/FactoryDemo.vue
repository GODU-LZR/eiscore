<template>
  <div class="factory-demo" data-guide="factory-demo">
    <header class="demo-header">
      <el-button class="icon-button" circle aria-label="返回企业站点运营" title="返回企业站点运营" @click="router.push('/')">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <div class="demo-heading">
        <div class="heading-line">
          <span class="sandbox-mark"><span></span>演示沙箱</span>
          <span class="trace-code">{{ DEMO_PRODUCT.traceNo }}</span>
        </div>
        <h1>全厂演示调度台</h1>
        <p>围绕同一张球房订单查看销售、采购、仓储、生产、质检和设备状态。</p>
      </div>
      <div class="header-actions">
        <el-button @click="openPublicSite">
          <el-icon><Link /></el-icon>
          独立站
        </el-button>
        <el-button @click="resetDemo">
          <el-icon><RefreshLeft /></el-icon>
          从头演示
        </el-button>
        <el-button type="primary" :disabled="!snapshot.nextAction" @click="advanceDemo">
          下一环节
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </header>

    <section class="boundary-band" aria-label="演示数据边界">
      <div class="boundary-main">
        <el-icon><Warning /></el-icon>
        <span>此页面不写入正式客户、订单、库存或生产任务。价格、尺寸、公差、工时和设备产能保持待确认。</span>
      </div>
      <div class="source-legend">
        <span v-for="(item, key) in DATA_STATUS" :key="key" class="source-item">
          <i :class="`source-${key}`"></i>{{ item.label }}
        </span>
      </div>
    </section>

    <section class="role-bar" aria-label="查看视角">
      <div class="role-copy">
        <span>当前视角</span>
        <strong>{{ selectedRoleConfig.label }}</strong>
        <small>{{ selectedRoleConfig.focus }}</small>
      </div>
      <div class="role-switch" role="group" aria-label="切换部门视角">
        <button
          v-for="role in DEMO_ROLES"
          :key="role.id"
          type="button"
          :class="{ active: selectedRole === role.id }"
          :aria-pressed="selectedRole === role.id"
          @click="selectRole(role.id)"
        >{{ role.label }}</button>
      </div>
    </section>

    <main class="demo-main">
      <section class="order-band" aria-labelledby="order-title">
        <div class="order-identity">
          <div class="order-code">{{ DEMO_PRODUCT.orderNo }}</div>
          <h2 id="order-title">{{ DEMO_PRODUCT.productName }}</h2>
          <div class="order-attributes">
            <span>{{ DEMO_PRODUCT.customerName }}</span>
            <span>{{ DEMO_PRODUCT.quantity }} 支</span>
            <span>{{ DEMO_PRODUCT.leadTimeDays }} 天演示交期</span>
            <span>{{ DEMO_PRODUCT.price }}</span>
          </div>
        </div>
        <div class="order-progress">
          <div class="progress-head"><span>订单进度</span><strong>{{ snapshot.progress }}%</strong></div>
          <div class="progress-track" role="progressbar" :aria-valuenow="snapshot.progress" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${snapshot.progress}%` }"></span>
          </div>
          <div class="progress-foot"><span>演示第 {{ snapshot.day }} / 30 天</span><b>{{ snapshot.stage.title }}</b></div>
        </div>
      </section>

      <section class="metric-strip" aria-label="订单核心指标">
        <div v-for="metric in metrics" :key="metric.key" class="metric-cell" :class="`metric-${metric.tone}`">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.note }}</small>
        </div>
      </section>

      <section class="passport-section" aria-labelledby="passport-title">
        <div class="section-head">
          <div>
            <span class="section-kicker">ORDER PASSPORT</span>
            <h2 id="passport-title">订单通行轨道</h2>
          </div>
          <div class="current-owner"><span>当前责任</span><strong>{{ snapshot.stage.owner }}</strong></div>
        </div>

        <div class="passport-scroll">
          <div class="passport-rail">
            <button
              v-for="step in snapshot.workflow"
              :key="step.id"
              type="button"
              class="passport-step"
              :class="[
                `is-${step.status}`,
                { selected: selectedStepIndex === step.index, focused: roleFocuses(step.module) }
              ]"
              :aria-current="step.status === 'active' ? 'step' : undefined"
              @click="selectedStepIndex = step.index"
            >
              <span class="step-node">
                <el-icon v-if="step.status === 'done'"><Check /></el-icon>
                <span v-else>{{ step.index + 1 }}</span>
              </span>
              <span class="step-day">D{{ step.day }}</span>
              <strong>{{ step.short }}</strong>
              <small>{{ step.owner }}</small>
            </button>
          </div>
        </div>

        <div class="step-inspector">
          <div class="step-inspector-main">
            <span class="module-code">{{ moduleName(selectedStep.module) }} · D{{ selectedStep.day }}</span>
            <h3>{{ selectedStep.title }}</h3>
            <p>{{ selectedStep.detail }}</p>
          </div>
          <div class="step-inspector-meta">
            <SourceBadge :status="selectedStep.sourceStatus" />
            <el-button text type="primary" @click="openModule(selectedStep.module)">打开正式模块<el-icon><ArrowRight /></el-icon></el-button>
          </div>
        </div>
      </section>

      <section class="control-layout">
        <div class="workspace-panel">
          <div class="workspace-tabs" role="tablist" aria-label="业务视图">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="activePanel === tab.id"
              :class="{ active: activePanel === tab.id }"
              @click="activePanel = tab.id"
            >
              <el-icon><component :is="tab.icon" /></el-icon>
              {{ tab.label }}
            </button>
          </div>

          <div v-if="activePanel === 'overview'" class="panel-content">
            <div class="panel-title">
              <div><h2>部门协同状态</h2><p>同一订单在正式模块中的责任边界和下一动作。</p></div>
              <SourceBadge status="demo" />
            </div>
            <div class="module-ledger">
              <article
                v-for="module in moduleSummaries"
                :key="module.id"
                class="module-row"
                :class="{ focused: roleFocuses(module.id) }"
              >
                <span class="module-icon"><el-icon><component :is="module.icon" /></el-icon></span>
                <div class="module-copy"><strong>{{ module.name }}</strong><span>{{ module.detail }}</span></div>
                <div class="module-state"><i :class="`state-${module.tone}`"></i>{{ module.state }}</div>
                <el-button class="row-action" text type="primary" @click="openModule(module.id)">进入</el-button>
              </article>
            </div>
          </div>

          <div v-else-if="activePanel === 'bom'" class="panel-content">
            <div class="panel-title">
              <div><h2>产品母版与演示 BOM</h2><p>{{ DEMO_PRODUCT.productCode }} · 通杆主体不包含接牙。</p></div>
              <el-button text type="primary" @click="openModule('bom')">打开产品配方</el-button>
            </div>
            <div class="product-facts">
              <div><span>结构</span><strong>{{ DEMO_PRODUCT.structure }}</strong><SourceBadge status="confirmed" /></div>
              <div><span>主体</span><strong>{{ DEMO_PRODUCT.primaryMaterial }}</strong><SourceBadge status="confirmed" /></div>
              <div><span>外观</span><strong>{{ DEMO_PRODUCT.appearance }}</strong><SourceBadge status="confirmed" /></div>
              <div><span>表面</span><strong>{{ DEMO_PRODUCT.finish }}</strong><SourceBadge status="confirmed" /></div>
            </div>
            <el-table :data="BOM_ITEMS" class="desktop-table" size="small" table-layout="fixed">
              <el-table-column prop="code" label="物料编码" width="170" />
              <el-table-column prop="name" label="物料" min-width="170" />
              <el-table-column prop="category" label="类别" width="100" />
              <el-table-column prop="unitQty" label="单支用量" width="105" />
              <el-table-column prop="orderQty" label="订单需求" width="105" />
              <el-table-column prop="operation" label="使用工序" min-width="150" />
              <el-table-column label="数据" width="90"><template #default="{ row }"><SourceBadge :status="row.sourceStatus" /></template></el-table-column>
            </el-table>
            <div class="mobile-record-list">
              <article v-for="item in BOM_ITEMS" :key="item.code" class="mobile-record">
                <div><strong>{{ item.name }}</strong><SourceBadge :status="item.sourceStatus" /></div>
                <span class="record-code">{{ item.code }}</span>
                <p>{{ item.category }} · 单支 {{ item.unitQty }} · 订单 {{ item.orderQty }}</p>
                <small>{{ item.operation }}</small>
              </article>
            </div>
          </div>

          <div v-else-if="activePanel === 'supply'" class="panel-content split-content">
            <section>
              <div class="panel-title compact">
                <div><h2>采购申请</h2><p>只生成演示建议，不自动向供应商下单。</p></div>
                <SourceBadge :status="snapshot.procurement.sourceStatus" />
              </div>
              <dl class="fact-list">
                <div><dt>申请单</dt><dd>{{ snapshot.procurement.requestNo }}</dd></div>
                <div><dt>需求</dt><dd>{{ snapshot.procurement.requestedQuantity }}</dd></div>
                <div><dt>供应商</dt><dd>{{ snapshot.procurement.supplier }}</dd></div>
                <div><dt>状态</dt><dd>{{ snapshot.procurement.status }}</dd></div>
              </dl>
              <el-button plain @click="openModule('purchase')">进入采购驾驶舱</el-button>
            </section>
            <section>
              <div class="panel-title compact">
                <div><h2>仓储四区</h2><p>原料、在制、成品和辅料使用独立逻辑区域。</p></div>
                <SourceBadge status="confirmed" />
              </div>
              <div class="zone-list">
                <div v-for="zone in snapshot.warehouse" :key="zone.id" class="zone-row">
                  <div><strong>{{ zone.name }}</strong><span>{{ zone.responsibility }}</span></div>
                  <b>{{ zone.quantity }}</b>
                </div>
              </div>
              <el-button plain @click="openModule('warehouse')">进入库存大屏</el-button>
            </section>
          </div>

          <div v-else-if="activePanel === 'production'" class="panel-content">
            <div class="panel-title">
              <div><h2>生产排程与工作中心</h2><p>详细日程为演示值，真实工时和产能仍待采集。</p></div>
              <el-button text type="primary" @click="openModule('production')">打开生产总览</el-button>
            </div>
            <div class="production-layout">
              <div class="operation-list">
                <article v-for="operation in PRODUCTION_OPERATIONS" :key="operation.no" class="operation-row">
                  <span class="operation-no">{{ operation.no }}</span>
                  <div><strong>{{ operation.name }}</strong><span>{{ operation.center }} · {{ operation.window }}</span><small>{{ operation.standard }}</small></div>
                  <SourceBadge :status="operation.sourceStatus" />
                </article>
              </div>
              <aside class="center-board">
                <h3>三个工作中心</h3>
                <div v-for="center in snapshot.equipment" :key="center.id" class="center-row">
                  <div><strong>{{ center.name }}</strong><span>{{ center.responsibility }}</span></div>
                  <b>{{ center.state }}</b>
                  <small>设备编号 {{ center.equipmentNo }} · {{ center.maintenance }}</small>
                </div>
                <el-button plain @click="openModule('equipment')">进入设备总览</el-button>
              </aside>
            </div>
          </div>

          <div v-else class="panel-content split-content">
            <section>
              <div class="panel-title compact">
                <div><h2>四道质量关卡</h2><p>检验项目已确认，数值标准仍待工厂提供。</p></div>
                <SourceBadge status="confirmed" />
              </div>
              <div class="quality-list">
                <article v-for="gate in snapshot.quality" :key="gate.id" class="quality-row">
                  <span class="quality-state"><el-icon><DocumentChecked /></el-icon></span>
                  <div><strong>{{ gate.name }}</strong><span>{{ gate.checks }}</span><small>{{ gate.owner }}</small></div>
                  <b>{{ gate.state }}</b>
                </article>
              </div>
              <el-button plain @click="openModule('quality')">进入质量总览</el-button>
            </section>
            <section>
              <div class="panel-title compact">
                <div><h2>交付控制</h2><p>只有终检和成品入库完成后才允许进入发货。</p></div>
                <SourceBadge status="demo" />
              </div>
              <dl class="fact-list">
                <div><dt>客户</dt><dd>{{ DEMO_PRODUCT.customerName }}</dd></div>
                <div><dt>数量</dt><dd>{{ DEMO_PRODUCT.quantity }} 支</dd></div>
                <div><dt>交期</dt><dd>{{ DEMO_PRODUCT.leadTimeDays }} 天演示值</dd></div>
                <div><dt>合格</dt><dd>{{ snapshot.metrics.passedQuantity }} 支</dd></div>
                <div><dt>成品库存</dt><dd>{{ snapshot.metrics.finishedStock }} 支</dd></div>
                <div><dt>已发货</dt><dd>{{ snapshot.metrics.deliveredQuantity }} 支</dd></div>
              </dl>
              <el-button plain @click="openModule('sales')">进入销售驾驶舱</el-button>
            </section>
          </div>
        </div>

        <aside class="risk-panel" aria-labelledby="risk-title">
          <div class="risk-head">
            <div><span>CONTROL QUEUE</span><h2 id="risk-title">待处理风险</h2></div>
            <strong>{{ visibleRisks.length }}</strong>
          </div>
          <div class="risk-list">
            <article v-for="risk in visibleRisks" :key="risk.id" class="risk-row" :class="`risk-${risk.level}`">
              <i></i>
              <div><strong>{{ risk.title }}</strong><span>{{ risk.owner }}</span><p>{{ risk.action }}</p></div>
            </article>
          </div>
          <div class="source-register">
            <h3>数据来源台账</h3>
            <div><span><i class="source-confirmed"></i>已确认</span><b>{{ sourceCounts.confirmed }}</b></div>
            <div><span><i class="source-demo"></i>演示</span><b>{{ sourceCounts.demo }}</b></div>
            <div><span><i class="source-pending"></i>待确认</span><b>{{ sourceCounts.pending }}</b></div>
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, defineComponent, h, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Collection,
  DataBoard,
  DocumentChecked,
  Goods,
  House,
  Link,
  OfficeBuilding,
  RefreshLeft,
  Setting,
  Tickets,
  Tools,
  Van,
  Warning
} from '@element-plus/icons-vue'
import {
  BOM_ITEMS,
  DATA_STATUS,
  DEFAULT_DEMO_STEP,
  DEMO_PRODUCT,
  DEMO_ROLES,
  DEMO_STORAGE_KEY,
  MODULE_ROUTES,
  PRODUCTION_OPERATIONS,
  createDemoSnapshot
} from '@/demo/factory-demo.js'

const router = useRouter()

const SourceBadge = defineComponent({
  name: 'SourceBadge',
  props: { status: { type: String, default: 'pending' } },
  setup(props) {
    return () => h('span', { class: ['source-badge', `badge-${props.status}`], title: DATA_STATUS[props.status]?.note || '' }, DATA_STATUS[props.status]?.label || '待确认')
  }
})

const readLocalState = () => {
  try {
    const value = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || '{}')
    return {
      step: Number.isInteger(value.step) ? value.step : DEFAULT_DEMO_STEP,
      role: DEMO_ROLES.some((item) => item.id === value.role) ? value.role : 'owner'
    }
  } catch {
    return { step: DEFAULT_DEMO_STEP, role: 'owner' }
  }
}

const initialState = typeof localStorage === 'undefined' ? { step: DEFAULT_DEMO_STEP, role: 'owner' } : readLocalState()
const demoStep = ref(initialState.step)
const selectedRole = ref(initialState.role)
const activePanel = ref('overview')
const selectedStepIndex = ref(initialState.step)

const snapshot = computed(() => createDemoSnapshot(demoStep.value))
const selectedStep = computed(() => snapshot.value.workflow[selectedStepIndex.value] || snapshot.value.stage)
const selectedRoleConfig = computed(() => DEMO_ROLES.find((item) => item.id === selectedRole.value) || DEMO_ROLES[0])

const tabs = [
  { id: 'overview', label: '全厂状态', icon: DataBoard },
  { id: 'bom', label: '产品 / BOM', icon: Box },
  { id: 'supply', label: '采购 / 仓储', icon: Goods },
  { id: 'production', label: '生产 / 设备', icon: Tools },
  { id: 'quality', label: '质检 / 交付', icon: DocumentChecked }
]

const metrics = computed(() => [
  { key: 'order', label: '订单数量', value: `${snapshot.value.metrics.orderQuantity} 支`, note: '已确认演示主线', tone: 'confirmed' },
  { key: 'gap', label: '材料缺口', value: `${snapshot.value.metrics.materialGap} 根`, note: '演示库存检查结果', tone: snapshot.value.metrics.materialGap ? 'warning' : 'confirmed' },
  { key: 'wip', label: '在制数量', value: `${snapshot.value.metrics.workInProgress} 支`, note: '浏览器演示状态', tone: 'demo' },
  { key: 'passed', label: '终检合格', value: `${snapshot.value.metrics.passedQuantity} 支`, note: '不代表真实良率', tone: snapshot.value.metrics.reworkQuantity ? 'danger' : 'demo' },
  { key: 'day', label: '演示时钟', value: `D${snapshot.value.day}`, note: `共 ${DEMO_PRODUCT.leadTimeDays} 天`, tone: 'steel' }
])

const moduleSummaries = computed(() => {
  const step = snapshot.value.activeStep
  return [
    { id: 'sales', name: '销售', icon: Tickets, state: step < 2 ? '处理中' : step >= 8 ? '售后跟进' : '订单已确认', tone: step < 2 ? 'active' : 'done', detail: DEMO_PRODUCT.price === '待报价' ? '订单主线已建立，正式价格仍待人工确认。' : '报价与订单已确认。' },
    { id: 'purchase', name: '采购', icon: Goods, state: step < 3 ? '等待需求' : step < 4 ? '采购处理中' : '演示到货', tone: step < 3 ? 'queued' : step < 4 ? 'active' : 'done', detail: '缺料只生成采购建议，供应商和采购价格待确认。' },
    { id: 'warehouse', name: '仓储', icon: House, state: step < 4 ? '待备料' : step < 7 ? '批次流转中' : '成品已入库', tone: step < 4 ? 'queued' : step < 7 ? 'active' : 'done', detail: '原材料、在制品、成品和辅料分区追踪。' },
    { id: 'production', name: '生产', icon: OfficeBuilding, state: step < 5 ? '等待排产' : step === 5 ? '演示生产中' : '演示完工', tone: step < 5 ? 'queued' : step === 5 ? 'active' : 'done', detail: '按 30 天演示排程串联八道工序。' },
    { id: 'quality', name: '质检', icon: DocumentChecked, state: step < 6 ? '过程检等待' : step === 6 ? '2 支演示返工' : '演示关闭', tone: step < 6 ? 'queued' : step === 6 ? 'danger' : 'done', detail: '四道质量关卡，数值公差保持待确认。' },
    { id: 'equipment', name: '设备', icon: Setting, state: step === 5 ? '车削中心运行' : '演示待机', tone: step === 5 ? 'active' : 'queued', detail: '三个工作中心已建模，设备编号和产能待采集。' }
  ]
})

const visibleRisks = computed(() => {
  if (selectedRole.value === 'owner') return snapshot.value.risks
  const label = selectedRoleConfig.value.label
  return [...snapshot.value.risks].sort((left, right) => Number(right.owner.includes(label)) - Number(left.owner.includes(label)))
})

const sourceCounts = computed(() => {
  const values = [
    DEMO_PRODUCT,
    ...BOM_ITEMS,
    ...PRODUCTION_OPERATIONS,
    ...snapshot.value.workflow
  ]
  return values.reduce((counts, item) => {
    const key = item.sourceStatus || 'pending'
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, { confirmed: 0, demo: 0, pending: 0 })
})

const moduleName = (value) => ({ sales: '销售', purchase: '采购', warehouse: '仓储', production: '生产', quality: '质检', equipment: '设备', bom: 'BOM', site: '独立站' }[value] || value)
const roleFocuses = (module) => selectedRole.value === 'owner' || selectedRoleConfig.value.modules.includes(module)

const panelForRole = (role) => ({ owner: 'overview', sales: 'overview', purchase: 'supply', warehouse: 'supply', production: 'production', equipment: 'production', quality: 'quality' }[role] || 'overview')

const selectRole = (role) => {
  selectedRole.value = role
  activePanel.value = panelForRole(role)
}

const persistState = () => {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ step: demoStep.value, role: selectedRole.value }))
  } catch {
    // The demo remains usable when browser storage is unavailable.
  }
}

watch([demoStep, selectedRole], persistState)

const resetDemo = () => {
  demoStep.value = 0
  selectedStepIndex.value = 0
  activePanel.value = 'overview'
  ElMessage.success('演示流程已回到独立站询盘')
}

const advanceDemo = () => {
  if (!snapshot.value.nextAction) return
  demoStep.value += 1
  selectedStepIndex.value = demoStep.value
  ElMessage.success(`已推进到：${createDemoSnapshot(demoStep.value).stage.title}`)
}

const openModule = (module) => {
  const route = MODULE_ROUTES[module]
  if (!route) return
  if (module === 'site') window.open(route, '_blank', 'noopener,noreferrer')
  else window.location.assign(route)
}

const openPublicSite = () => openModule('site')
</script>

<style scoped>
.factory-demo {
  --demo-ink: var(--el-text-color-primary, #202622);
  --demo-muted: var(--el-text-color-secondary, #68716c);
  --demo-page: var(--el-bg-color-page, #f4f6f3);
  --demo-surface: var(--el-bg-color, #ffffff);
  --demo-line: var(--el-border-color-lighter, #dfe4df);
  --demo-ash: #557565;
  --demo-steel: #4e6e7d;
  --demo-amber: #b47732;
  --demo-red: #a94f46;
  min-height: 100vh;
  padding: 20px 24px 32px;
  color: var(--demo-ink);
  background: var(--demo-page);
  letter-spacing: 0;
}

.demo-header,
.boundary-band,
.role-bar,
.demo-main {
  width: min(1540px, 100%);
  margin-right: auto;
  margin-left: auto;
}

.demo-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding-bottom: 16px;
}

.icon-button { flex: 0 0 auto; }
.demo-heading { min-width: 0; }
.heading-line { display: flex; align-items: center; gap: 10px; min-width: 0; color: var(--demo-muted); font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.sandbox-mark { display: inline-flex; align-items: center; gap: 6px; color: var(--demo-amber); font-weight: 700; }
.sandbox-mark span { width: 7px; height: 7px; border-radius: 50%; background: var(--demo-amber); }
.trace-code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.demo-heading h1 { margin: 5px 0 3px; font-size: 27px; line-height: 1.2; letter-spacing: 0; }
.demo-heading p { margin: 0; color: var(--demo-muted); font-size: 13px; line-height: 1.55; }
.header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.header-actions :deep(.el-button + .el-button) { margin-left: 0; }

.boundary-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 42px;
  padding: 9px 12px;
  color: #6e4b1f;
  border: 1px solid rgba(180, 119, 50, .45);
  border-radius: 4px;
  background: rgba(180, 119, 50, .09);
  font-size: 12px;
}
.boundary-main, .source-legend, .source-item { display: flex; align-items: center; }
.boundary-main { gap: 8px; min-width: 0; }
.source-legend { flex: 0 0 auto; gap: 14px; color: var(--demo-muted); }
.source-item { gap: 5px; white-space: nowrap; }
.source-item i, .source-register i { width: 8px; height: 8px; border-radius: 50%; }
.source-confirmed { background: var(--demo-ash); }
.source-demo { background: var(--demo-steel); }
.source-pending { background: var(--demo-amber); }

.role-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 0;
}
.role-copy { display: grid; grid-template-columns: auto auto; align-items: baseline; gap: 2px 8px; min-width: 220px; }
.role-copy span { color: var(--demo-muted); font-size: 11px; }
.role-copy strong { font-size: 14px; }
.role-copy small { grid-column: 1 / -1; color: var(--demo-muted); font-size: 11px; }
.role-switch { display: flex; min-width: 0; overflow-x: auto; border: 1px solid var(--demo-line); border-radius: 4px; background: var(--demo-surface); scrollbar-width: thin; }
.role-switch button { flex: 0 0 auto; min-width: 70px; height: 36px; padding: 0 13px; color: var(--demo-muted); border: 0; border-right: 1px solid var(--demo-line); background: transparent; cursor: pointer; font: inherit; font-size: 12px; }
.role-switch button:last-child { border-right: 0; }
.role-switch button.active { color: #fff; background: var(--demo-ash); }
.role-switch button:focus-visible, .passport-step:focus-visible, .workspace-tabs button:focus-visible { outline: 2px solid var(--demo-steel); outline-offset: 2px; }

.demo-main { display: grid; gap: 14px; }
.order-band { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(360px, .65fr); gap: 28px; padding: 20px; border: 1px solid var(--demo-line); border-radius: 6px; background: var(--demo-surface); }
.order-code, .section-kicker, .module-code { color: var(--demo-steel); font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
.order-identity h2 { margin: 6px 0 10px; font-size: 20px; letter-spacing: 0; }
.order-attributes { display: flex; flex-wrap: wrap; gap: 0; color: var(--demo-muted); font-size: 12px; }
.order-attributes span { padding: 0 10px; border-left: 1px solid var(--demo-line); }
.order-attributes span:first-child { padding-left: 0; border-left: 0; }
.order-progress { align-self: center; }
.progress-head, .progress-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.progress-head { color: var(--demo-muted); font-size: 11px; }
.progress-head strong { color: var(--demo-ash); font-size: 18px; }
.progress-track { height: 7px; margin: 8px 0; overflow: hidden; border-radius: 2px; background: var(--el-fill-color, #e7ebe8); }
.progress-track span { display: block; height: 100%; background: var(--demo-ash); transition: width .25s ease; }
.progress-foot { color: var(--demo-muted); font-size: 11px; }
.progress-foot b { color: var(--demo-ink); font-weight: 650; }

.metric-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid var(--demo-line); border-radius: 6px; background: var(--demo-surface); }
.metric-cell { min-width: 0; min-height: 92px; padding: 14px 16px; border-right: 1px solid var(--demo-line); }
.metric-cell:last-child { border-right: 0; }
.metric-cell > span { display: block; color: var(--demo-muted); font-size: 11px; }
.metric-cell strong { display: block; margin-top: 7px; font-size: 23px; line-height: 1; }
.metric-cell small { display: block; margin-top: 8px; overflow: hidden; color: var(--demo-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.metric-warning strong { color: var(--demo-amber); }
.metric-danger strong { color: var(--demo-red); }
.metric-confirmed strong { color: var(--demo-ash); }
.metric-demo strong, .metric-steel strong { color: var(--demo-steel); }

.passport-section, .workspace-panel, .risk-panel { border: 1px solid var(--demo-line); border-radius: 6px; background: var(--demo-surface); }
.passport-section { padding: 18px; overflow: hidden; }
.section-head, .panel-title, .risk-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-head h2, .panel-title h2, .risk-head h2 { margin: 3px 0 0; font-size: 16px; letter-spacing: 0; }
.current-owner { display: grid; justify-items: end; gap: 3px; color: var(--demo-muted); font-size: 10px; }
.current-owner strong { color: var(--demo-ink); font-size: 12px; }
.passport-scroll { margin-top: 20px; overflow-x: auto; padding: 3px 2px 9px; scrollbar-width: thin; }
.passport-rail { position: relative; display: grid; grid-template-columns: repeat(9, minmax(90px, 1fr)); min-width: 920px; }
.passport-rail::before { content: ''; position: absolute; top: 18px; right: 5.5%; left: 5.5%; height: 3px; background: var(--demo-line); }
.passport-step { position: relative; z-index: 1; display: grid; justify-items: center; gap: 4px; min-width: 0; padding: 0 4px 8px; color: var(--demo-muted); border: 0; background: transparent; cursor: pointer; font: inherit; }
.step-node { display: grid; place-items: center; width: 38px; height: 38px; color: var(--demo-muted); border: 2px solid var(--demo-line); border-radius: 50%; background: var(--demo-surface); font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.passport-step.is-done .step-node { color: #fff; border-color: var(--demo-ash); background: var(--demo-ash); }
.passport-step.is-active .step-node { color: #fff; border-color: var(--demo-amber); background: var(--demo-amber); box-shadow: 0 0 0 4px rgba(180, 119, 50, .14); }
.passport-step.selected::after { content: ''; position: absolute; right: 18%; bottom: 0; left: 18%; height: 2px; background: var(--demo-steel); }
.passport-step.focused strong { color: var(--demo-ink); }
.step-day { margin-top: 4px; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
.passport-step strong { overflow: hidden; max-width: 100%; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.passport-step small { font-size: 9px; white-space: nowrap; }
.step-inspector { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 96px; margin-top: 8px; padding: 14px 16px; border-top: 1px solid var(--demo-line); background: var(--el-fill-color-light, #f7f8f7); }
.step-inspector-main { min-width: 0; }
.step-inspector h3 { margin: 4px 0; font-size: 15px; }
.step-inspector p { margin: 0; color: var(--demo-muted); font-size: 12px; line-height: 1.55; }
.step-inspector-meta { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }

.source-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 48px; min-height: 22px; padding: 2px 7px; border: 1px solid; border-radius: 3px; font-size: 10px; white-space: nowrap; }
.badge-confirmed { color: var(--demo-ash); border-color: rgba(85, 117, 101, .4); background: rgba(85, 117, 101, .08); }
.badge-demo { color: var(--demo-steel); border-color: rgba(78, 110, 125, .4); background: rgba(78, 110, 125, .08); }
.badge-pending { color: var(--demo-amber); border-color: rgba(180, 119, 50, .4); background: rgba(180, 119, 50, .08); }

.control-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; align-items: start; gap: 14px; }
.workspace-panel { min-width: 0; overflow: hidden; }
.workspace-tabs { display: flex; overflow-x: auto; border-bottom: 1px solid var(--demo-line); scrollbar-width: thin; }
.workspace-tabs button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: 6px; min-width: 116px; height: 46px; padding: 0 14px; color: var(--demo-muted); border: 0; border-right: 1px solid var(--demo-line); background: transparent; cursor: pointer; font: inherit; font-size: 12px; }
.workspace-tabs button.active { color: var(--demo-ash); box-shadow: inset 0 -3px var(--demo-ash); background: rgba(85, 117, 101, .05); }
.panel-content { min-height: 410px; padding: 18px; }
.panel-title { margin-bottom: 14px; }
.panel-title p { margin: 4px 0 0; color: var(--demo-muted); font-size: 11px; line-height: 1.5; }
.panel-title.compact { margin-bottom: 12px; }
.module-ledger { border-top: 1px solid var(--demo-line); }
.module-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) 140px 54px; align-items: center; gap: 12px; min-height: 62px; padding: 8px 4px; border-bottom: 1px solid var(--demo-line); }
.module-row.focused { box-shadow: inset 3px 0 var(--demo-ash); padding-left: 10px; }
.module-icon { display: grid; place-items: center; width: 32px; height: 32px; color: var(--demo-steel); border: 1px solid var(--demo-line); border-radius: 4px; }
.module-copy { display: grid; gap: 3px; min-width: 0; }
.module-copy strong { font-size: 13px; }
.module-copy span { overflow: hidden; color: var(--demo-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.module-state { display: flex; align-items: center; gap: 7px; color: var(--demo-muted); font-size: 11px; }
.module-state i { width: 7px; height: 7px; border-radius: 50%; }
.state-done { background: var(--demo-ash); }.state-active { background: var(--demo-steel); }.state-danger { background: var(--demo-red); }.state-queued { background: #9aa39e; }

.product-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px; border: 1px solid var(--demo-line); }
.product-facts > div { display: grid; gap: 5px; min-width: 0; padding: 11px; border-right: 1px solid var(--demo-line); }
.product-facts > div:last-child { border-right: 0; }
.product-facts span:first-child { color: var(--demo-muted); font-size: 10px; }
.product-facts strong { font-size: 13px; }
.product-facts .source-badge { width: fit-content; }
.desktop-table { width: 100%; }
.desktop-table :deep(.el-table__inner-wrapper::before) { display: none; }
.desktop-table :deep(.el-table__cell) { padding: 7px 0; }
.desktop-table :deep(.cell) { font-size: 11px; }
.mobile-record-list { display: none; }

.split-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
.split-content > section { min-width: 0; }
.split-content > section + section { padding-left: 22px; border-left: 1px solid var(--demo-line); }
.fact-list { margin: 0 0 14px; border-top: 1px solid var(--demo-line); }
.fact-list > div { display: grid; grid-template-columns: 105px minmax(0, 1fr); gap: 10px; padding: 10px 2px; border-bottom: 1px solid var(--demo-line); }
.fact-list dt { color: var(--demo-muted); font-size: 11px; }
.fact-list dd { margin: 0; font-size: 12px; text-align: right; }
.zone-list, .quality-list { display: grid; margin-bottom: 14px; border-top: 1px solid var(--demo-line); }
.zone-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 55px; padding: 8px 2px; border-bottom: 1px solid var(--demo-line); }
.zone-row > div { display: grid; gap: 3px; min-width: 0; }
.zone-row strong { font-size: 12px; }.zone-row span { color: var(--demo-muted); font-size: 10px; }.zone-row b { color: var(--demo-steel); font-size: 11px; }

.production-layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(250px, .75fr); gap: 18px; }
.operation-list { border-top: 1px solid var(--demo-line); }
.operation-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 62px; padding: 8px 2px; border-bottom: 1px solid var(--demo-line); }
.operation-no { color: var(--demo-steel); font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.operation-row > div { display: grid; gap: 2px; min-width: 0; }
.operation-row strong { font-size: 12px; }.operation-row span { color: var(--demo-muted); font-size: 10px; }.operation-row small { overflow: hidden; color: var(--demo-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.center-board { padding-left: 18px; border-left: 1px solid var(--demo-line); }
.center-board h3 { margin: 0 0 8px; font-size: 13px; }
.center-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 8px; padding: 10px 0; border-bottom: 1px solid var(--demo-line); }
.center-row > div { display: grid; gap: 2px; }.center-row strong { font-size: 12px; }.center-row span, .center-row small { color: var(--demo-muted); font-size: 10px; }.center-row b { color: var(--demo-steel); font-size: 10px; }.center-row small { grid-column: 1 / -1; }
.center-board .el-button { margin-top: 14px; }

.quality-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 68px; padding: 8px 2px; border-bottom: 1px solid var(--demo-line); }
.quality-state { display: grid; place-items: center; width: 29px; height: 29px; color: var(--demo-ash); border: 1px solid rgba(85, 117, 101, .35); border-radius: 50%; }
.quality-row > div { display: grid; gap: 2px; min-width: 0; }.quality-row strong { font-size: 12px; }.quality-row span, .quality-row small { color: var(--demo-muted); font-size: 10px; }.quality-row b { max-width: 120px; color: var(--demo-steel); font-size: 10px; text-align: right; }

.risk-panel { position: sticky; top: 12px; overflow: hidden; }
.risk-head { align-items: center; padding: 16px; color: #f1f4f1; background: #29322d; }
.risk-head span { color: #aebbb4; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }.risk-head h2 { color: #fff; }.risk-head > strong { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #607167; border-radius: 50%; font-size: 15px; }
.risk-list { padding: 4px 14px; }
.risk-row { display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 9px; padding: 12px 0; border-bottom: 1px solid var(--demo-line); }
.risk-row > i { width: 8px; height: 8px; margin-top: 4px; border-radius: 50%; background: var(--demo-amber); }
.risk-danger > i { background: var(--demo-red); }.risk-pending > i { background: var(--demo-amber); }.risk-warning > i { background: var(--demo-steel); }
.risk-row > div { display: grid; gap: 3px; }.risk-row strong { font-size: 12px; }.risk-row span { color: var(--demo-muted); font-size: 10px; }.risk-row p { margin: 3px 0 0; color: var(--demo-muted); font-size: 10px; line-height: 1.5; }
.source-register { padding: 14px; background: var(--el-fill-color-light, #f7f8f7); border-top: 1px solid var(--demo-line); }
.source-register h3 { margin: 0 0 8px; font-size: 12px; }
.source-register > div { display: flex; align-items: center; justify-content: space-between; min-height: 28px; color: var(--demo-muted); font-size: 10px; }
.source-register span { display: flex; align-items: center; gap: 7px; }.source-register b { color: var(--demo-ink); font-size: 11px; }

@media (max-width: 1100px) {
  .demo-header { grid-template-columns: auto minmax(0, 1fr); }
  .header-actions { grid-column: 2; justify-content: flex-start; }
  .role-bar { align-items: flex-start; flex-direction: column; gap: 10px; }
  .role-switch { width: 100%; }
  .control-layout { grid-template-columns: minmax(0, 1fr) 270px; }
  .metric-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric-cell { border-bottom: 1px solid var(--demo-line); }
  .metric-cell:nth-child(3) { border-right: 0; }
  .metric-cell:nth-child(n + 4) { border-bottom: 0; }
  .production-layout { grid-template-columns: 1fr; }
  .center-board { padding: 14px 0 0; border-top: 1px solid var(--demo-line); border-left: 0; }
}

@media (max-width: 780px) {
  .factory-demo { padding: 12px 10px 24px; }
  .demo-header { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 10px; }
  .demo-heading h1 { font-size: 22px; }
  .demo-heading p { font-size: 12px; }
  .header-actions { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
  .header-actions :deep(.el-button) { width: 100%; margin: 0; padding-right: 8px; padding-left: 8px; }
  .boundary-band { align-items: flex-start; flex-direction: column; gap: 8px; }
  .source-legend { width: 100%; justify-content: space-between; }
  .role-bar { padding: 10px 0; }
  .role-switch button { min-width: 64px; padding: 0 10px; }
  .order-band { grid-template-columns: 1fr; gap: 16px; padding: 15px; }
  .order-identity h2 { font-size: 17px; }
  .order-attributes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .order-attributes span { padding: 0; border: 0; }
  .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-cell { min-height: 84px; border-right: 1px solid var(--demo-line); border-bottom: 1px solid var(--demo-line); }
  .metric-cell:nth-child(even) { border-right: 0; }
  .metric-cell:nth-child(3) { border-right: 1px solid var(--demo-line); }
  .metric-cell:nth-child(n + 4) { border-bottom: 1px solid var(--demo-line); }
  .metric-cell:last-child { grid-column: 1 / -1; border-right: 0; border-bottom: 0; }
  .passport-section { padding: 14px 10px; }
  .section-head { padding: 0 4px; }
  .passport-rail { min-width: 830px; }
  .step-inspector { align-items: flex-start; flex-direction: column; gap: 10px; padding: 13px 8px; }
  .step-inspector-meta { width: 100%; justify-content: space-between; }
  .control-layout { grid-template-columns: 1fr; }
  .risk-panel { position: static; }
  .workspace-tabs button { min-width: 105px; padding: 0 10px; }
  .panel-content { min-height: 0; padding: 14px 12px; }
  .module-row { grid-template-columns: 34px minmax(0, 1fr) auto; gap: 9px; }
  .module-state { grid-column: 2; }
  .row-action { grid-column: 3; grid-row: 1 / span 2; }
  .module-copy span { white-space: normal; line-height: 1.4; }
  .product-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .product-facts > div:nth-child(2) { border-right: 0; }
  .product-facts > div:nth-child(-n + 2) { border-bottom: 1px solid var(--demo-line); }
  .desktop-table { display: none; }
  .mobile-record-list { display: grid; border-top: 1px solid var(--demo-line); }
  .mobile-record { padding: 11px 2px; border-bottom: 1px solid var(--demo-line); }
  .mobile-record > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .mobile-record strong { font-size: 12px; }.record-code { display: block; margin-top: 3px; color: var(--demo-steel); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }.mobile-record p { margin: 7px 0 3px; color: var(--demo-muted); font-size: 11px; }.mobile-record small { color: var(--demo-muted); font-size: 10px; }
  .split-content { grid-template-columns: 1fr; gap: 20px; }
  .split-content > section + section { padding: 20px 0 0; border-top: 1px solid var(--demo-line); border-left: 0; }
  .operation-row { grid-template-columns: 30px minmax(0, 1fr); }
  .operation-row .source-badge { grid-column: 2; width: fit-content; }
  .operation-row small { white-space: normal; line-height: 1.35; }
  .quality-row { grid-template-columns: 30px minmax(0, 1fr); }
  .quality-row b { grid-column: 2; max-width: none; text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  .progress-track span { transition: none; }
}
</style>
