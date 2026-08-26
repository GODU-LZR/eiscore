<template>
  <div class="jinwei-workbench" data-guide="jinwei-manufacturing">
    <header class="workbench-header">
      <div class="workbench-brand">
        <button class="back-button" type="button" aria-label="返回经纬独立站" title="返回经纬独立站" @click="router.push('/jinwei')">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="workbench-kicker"><span class="status-light"></span> JINGWEI / MANUFACTURING CONTROL</div>
          <h1>经纬制造协同台</h1>
          <p>把合同规格、车间交接、质量和合同归属库存放到同一条生产线上。</p>
        </div>
      </div>
      <div class="header-tools">
        <span class="environment-chip" :class="`is-${liveState}`">{{ liveStateLabel }}</span>
        <a class="header-system-link" :href="JINWEI_SYSTEM_URL" target="_blank" rel="noreferrer" title="打开完整 EISCore 制造系统"><el-icon><DataBoard /></el-icon>完整 EISCore</a>
        <button class="header-site-link" type="button" @click="router.push('/jinwei')"><el-icon><Link /></el-icon>独立站</button>
        <button class="header-reset" type="button" @click="resetDemo"><el-icon><RefreshLeft /></el-icon>重置</button>
        <button class="header-next" type="button" :disabled="!snapshot.nextAction" @click="advanceWorkflow">推进下一环节<el-icon><ArrowRight /></el-icon></button>
      </div>
    </header>

    <section class="boundary-banner" aria-label="数据边界说明">
      <div><el-icon><Warning /></el-icon><span>本页使用调研样表和演示快照验证流程。历史合同、现场记录和演示数量不会自动创建正式单据。</span></div>
      <div class="source-key">
        <span v-for="(item, key) in JINWEI_SOURCE_STATUS" :key="key"><i :class="`source-dot-${key}`"></i>{{ item.label }}</span>
      </div>
    </section>

    <section class="role-toolbar" aria-label="角色视角">
      <div class="role-caption"><span>当前注意力视角</span><strong>{{ roleConfig.label }}</strong><small>{{ roleConfig.focus }}</small></div>
      <div class="role-switch" role="group" aria-label="切换角色">
        <button v-for="item in JINWEI_ROLES" :key="item.id" type="button" :class="{ active: role === item.id }" :aria-pressed="role === item.id" @click="selectRole(item.id)">{{ item.label }}</button>
      </div>
    </section>

    <main class="workbench-main">
      <section class="control-header" aria-labelledby="control-title">
        <div class="order-identity">
          <div class="identity-line"><span class="demo-label">DEMO ORDER</span><code>{{ JINWEI_DEMO_ORDER.orderNo }}</code><SourceBadge status="demo" /></div>
          <h2 id="control-title">{{ JINWEI_DEMO_ORDER.productName }}</h2>
          <p>{{ JINWEI_DEMO_ORDER.customer }} · {{ JINWEI_DEMO_ORDER.quantityPieces }} 条演示需求 · {{ JINWEI_DEMO_ORDER.deliveryBatches }} 批交付</p>
        </div>
        <div class="progress-box">
          <div class="progress-title"><span>流程推进</span><strong>{{ snapshot.progress }}%</strong></div>
          <div class="progress-track" role="progressbar" :aria-valuenow="snapshot.progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${snapshot.progress}%` }"></i></div>
          <div class="progress-meta"><span>当前：{{ snapshot.stage.title }}</span><b>{{ snapshot.stage.owner }}</b></div>
        </div>
      </section>

      <section class="metrics-row" aria-label="制造关键指标">
        <div class="metric metric-focus"><span>规格待锁定</span><strong>{{ effectiveMetrics.unresolvedSpecs }}</strong><small>关键字段未确认</small></div>
        <div class="metric"><span>计划数量</span><strong>{{ effectiveMetrics.plannedPieces }}</strong><small>条 / 演示需求</small></div>
        <div class="metric metric-green"><span>已完成</span><strong>{{ effectiveMetrics.completedPieces }}</strong><small>条 / 工序报工快照</small></div>
        <div class="metric metric-blue"><span>在制数量</span><strong>{{ effectiveMetrics.wipPieces }}</strong><small>条 / 当前 WIP</small></div>
        <div class="metric metric-warning"><span>开放交接</span><strong>{{ effectiveMetrics.openHandoffs }}</strong><small>待扫描或待对账</small></div>
      </section>

      <section class="workflow-panel" aria-labelledby="workflow-title">
        <div class="panel-heading">
          <div><span class="panel-eyebrow">ORDER PASSPORT</span><h2 id="workflow-title">订单通行轨道</h2></div>
          <div class="current-stage"><span>下一责任</span><strong>{{ snapshot.nextAction ? snapshot.nextAction.owner : '已完成' }}</strong></div>
        </div>
        <div class="workflow-scroll">
          <div class="workflow-rail">
            <button v-for="item in snapshot.workflow" :key="item.id" type="button" class="workflow-node" :class="[`is-${item.state}`, { selected: selectedWorkflow === item.index }]" :aria-current="item.state === 'active' ? 'step' : undefined" @click="selectedWorkflow = item.index">
              <span class="node-circle"><el-icon v-if="item.state === 'done'"><Check /></el-icon><b v-else>{{ item.sequence }}</b></span>
              <small>{{ item.short }}</small><strong>{{ item.owner }}</strong>
            </button>
          </div>
        </div>
        <div class="workflow-inspector">
          <div><span class="inspector-module">{{ moduleLabel(selectedStep.module) }} · {{ selectedStep.sourceStatus === 'observed' ? '现场证据' : selectedStep.sourceStatus === 'workbook' ? '历史样表' : '演示' }}</span><h3>{{ selectedStep.title }}</h3><p>{{ selectedStep.detail }}</p></div>
          <button type="button" class="inspector-action" @click="openModule(selectedStep.module)">打开责任模块<el-icon><ArrowRight /></el-icon></button>
        </div>
      </section>

      <section class="attention-focus" aria-label="当前最高优先级事项">
        <div class="focus-card">
          <div class="focus-card-label"><span class="priority-pip"></span>NOW / 当前第一关注</div>
          <div class="focus-card-content"><div><h2>{{ topAttention.title }}</h2><p>{{ topAttention.nextAction }}</p></div><strong>{{ topAttention.score }}</strong></div>
          <div class="focus-card-foot"><span>{{ topAttention.owner }}</span><SourceBadge :status="topAttention.sourceStatus" /><button type="button" @click="activeView = viewForModule(topAttention.module)">进入处理视图<el-icon><ArrowRight /></el-icon></button></div>
        </div>
        <div class="attention-summary"><span>本角色待处理</span><strong>{{ snapshot.attention.length }}</strong><small>按紧急度、业务影响和追溯风险排序</small></div>
        <div class="attention-summary"><span>数据来源</span><strong>{{ sourceCounts.observed + sourceCounts.workbook }}</strong><small>现场证据 + 历史样表字段</small></div>
      </section>

      <section class="workspace-grid">
        <div class="workspace-panel">
          <div class="workspace-tabs" role="tablist" aria-label="制造协同视图">
            <button type="button" role="tab" :aria-selected="activeView === 'plan'" :class="{ active: activeView === 'plan' }" @click="activeView = 'plan'"><el-icon><DataBoard /></el-icon>计划与规格</button>
            <button type="button" role="tab" :aria-selected="activeView === 'handoffs'" :class="{ active: activeView === 'handoffs' }" @click="activeView = 'handoffs'"><el-icon><Van /></el-icon>工序交接</button>
            <button type="button" role="tab" :aria-selected="activeView === 'trace'" :class="{ active: activeView === 'trace' }" @click="activeView = 'trace'"><el-icon><Link /></el-icon>追溯链</button>
            <button type="button" role="tab" :aria-selected="activeView === 'master'" :class="{ active: activeView === 'master' }" @click="activeView = 'master'"><el-icon><Setting /></el-icon>主数据采集</button>
          </div>

          <div v-if="activeView === 'plan'" class="workspace-content">
            <div class="content-heading"><div><span class="panel-eyebrow">SPECIFICATION GATE</span><h2>规格版本与齐套判断</h2><p>报价和排产前先锁定字段，避免同一规格在多个 Excel 表中重复改写。</p></div><span class="version-chip">{{ JINWEI_TRACE_SAMPLE.specVersion }}</span></div>
            <div class="spec-summary">
              <div v-for="field in visibleSpecFields" :key="field.key" class="spec-summary-cell" :class="{ pending: field.key === 'packing' || field.key === 'weight' }"><span>{{ field.label }}</span><strong>{{ JINWEI_DEMO_ORDER.spec[field.key] || '待确认' }}</strong><small>{{ field.examples }}</small><SourceBadge :status="field.sourceStatus" /></div>
            </div>
            <div class="subheading"><h3>历史排产样表回放</h3><span>仅用于验证字段映射，不代表当前订单</span></div>
            <div class="historical-table-wrap">
              <table class="historical-table"><thead><tr><th>来源 / 合同</th><th>产品</th><th>规格示例</th><th>路线</th><th>交期</th><th>数据</th></tr></thead><tbody><tr v-for="item in JINWEI_HISTORICAL_ORDERS" :key="item.contract"><td><strong>{{ item.contract }}</strong><small>{{ item.sourceFile }}</small></td><td>{{ item.product }}<small>{{ item.construction }}</small></td><td>{{ item.spec }}<small>{{ item.quantity }}</small></td><td>{{ item.route }}</td><td>{{ item.dueDate }}</td><td><SourceBadge :status="item.sourceStatus" /></td></tr></tbody></table>
            </div>
            <div class="mobile-records"><article v-for="item in JINWEI_HISTORICAL_ORDERS" :key="item.contract"><div><strong>{{ item.contract }}</strong><SourceBadge status="workbook" /></div><span>{{ item.product }} · {{ item.spec }}</span><small>{{ item.route }} · {{ item.dueDate }}</small></article></div>
          </div>

          <div v-else-if="activeView === 'handoffs'" class="workspace-content">
            <div class="content-heading"><div><span class="panel-eyebrow">SCAN & HANDOFF</span><h2>工序交接队列</h2><p>每次领用、移交、发出和交回都必须绑定合同、规格版本与数量。</p></div><button type="button" class="outline-action" @click="simulateScan">模拟扫描<el-icon><Van /></el-icon></button></div>
            <div class="handoff-list"><article v-for="handoff in handoffs" :key="handoff.id" class="handoff-row" :class="`handoff-${handoff.state}`"><div class="handoff-code"><span>{{ handoff.id }}</span><strong>{{ handoff.code }}</strong></div><div class="handoff-route"><span>{{ handoff.from }}</span><b>→</b><span>{{ handoff.to }}</span></div><div class="handoff-item"><strong>{{ handoff.item }}</strong><small>{{ handoff.quantity }} · {{ handoff.contract }}</small></div><SourceBadge :status="handoff.sourceStatus" /><button v-if="handoff.state !== 'received'" type="button" class="row-action" @click="receiveHandoff(handoff)">{{ handoff.state === 'outsource' ? '登记发出' : '扫码接收' }}<el-icon><Check /></el-icon></button><span v-else class="received-label"><el-icon><Check /></el-icon>已接收</span></article></div>
            <div class="handoff-rule"><el-icon><DocumentChecked /></el-icon><span>规则：实收数量、批次和合同不一致时，系统阻止过站并把异常推送给计划员和质检员。</span></div>
          </div>

          <div v-else-if="activeView === 'trace'" class="workspace-content">
            <div class="content-heading"><div><span class="panel-eyebrow">TRACEABILITY</span><h2>一物一码追溯链</h2><p>从原料批次到包装码，反向可查机台、人员、检验与合同归属。</p></div><code class="trace-code">{{ JINWEI_TRACE_SAMPLE.code }}</code></div>
            <div class="trace-header"><div><span>产品</span><strong>{{ JINWEI_TRACE_SAMPLE.product }}</strong></div><div><span>合同</span><strong>{{ JINWEI_TRACE_SAMPLE.contract }}</strong></div><div><span>规格版本</span><strong>{{ JINWEI_TRACE_SAMPLE.specVersion }}</strong></div><div><span>当前站点</span><strong>{{ JINWEI_TRACE_SAMPLE.currentStep }}</strong></div></div>
            <ol class="trace-chain"><li v-for="item in JINWEI_TRACE_CHAIN" :key="item.no" :class="`trace-${item.sourceStatus}`"><span class="trace-no">{{ item.no }}</span><div><strong>{{ item.label }}</strong><code>{{ item.value }}</code><small>{{ item.detail }}</small></div><SourceBadge :status="item.sourceStatus" /></li></ol>
            <div class="trace-note"><el-icon><Warning /></el-icon><span>包装码尚未生成。只有终检通过、唛头和净重确认后，仓库才能创建正式成品包装单元。</span></div>
          </div>

          <div v-else class="workspace-content">
            <div class="content-heading"><div><span class="panel-eyebrow">MASTER DATA CAPTURE</span><h2>主数据采集清单</h2><p>第一阶段优先采集能让现场开始扫码和报工的最小字段。</p></div><button type="button" class="outline-action" @click="activeView = 'plan'">回到规格闸门<el-icon><ArrowLeft /></el-icon></button></div>
            <div class="center-grid"><article v-for="center in JINWEI_WORK_CENTERS" :key="center.id" class="center-card"><div class="center-card-top"><span class="center-index">{{ center.id.slice(0, 2).toUpperCase() }}</span><SourceBadge :status="center.sourceStatus" /></div><h3>{{ center.name }}</h3><p>{{ center.evidence }}</p><small><strong>首批采集：</strong>{{ center.capture }}</small></article></div>
            <section class="standards-panel" aria-labelledby="standards-title">
              <div class="standards-heading">
                <div><span class="panel-eyebrow">COMPLIANCE BASELINE</span><h3 id="standards-title">标准基线</h3><p>根据国家标准全文公开系统联网核验，用于设计规格、检验和追溯字段。</p></div>
                <span class="standards-boundary"><el-icon><Warning /></el-icon>适用基线，不等同于认证</span>
              </div>
              <div class="standards-grid">
                <article v-for="standard in JINWEI_COMPLIANCE_STANDARDS" :key="standard.code" class="standard-card">
                  <div class="standard-top"><code>{{ standard.code }}</code><span class="standard-current"><i></i>{{ standard.status }}</span></div>
                  <h4>{{ standard.title }}</h4>
                  <p>{{ standard.implementationUse }}</p>
                  <div class="standard-foot"><span>实施 {{ standard.effectiveDate }}</span><a :href="standard.url" target="_blank" rel="noreferrer">查看原文<el-icon><Link /></el-icon></a></div>
                </article>
              </div>
              <div class="research-register"><span><el-icon><DocumentChecked /></el-icon>官方项目公告已单独登记：制线扩建批复、环评受理和锅炉改造审批；产业规模与登记摘要仍标记为待确认。</span><a :href="officialResearch[0]?.url" target="_blank" rel="noreferrer">查看公告证据<el-icon><Link /></el-icon></a></div>
            </section>
            <div class="capture-order"><span>建议采集顺序</span><strong>物料与规格 → 仓库/库位 → 工位与机台 → 质量项目 → 包装码规则</strong><small>设备 PLC 自动采集作为第二阶段，不作为首批上线前置。</small></div>
          </div>
        </div>

        <aside class="attention-sidebar" aria-labelledby="queue-title">
          <div class="sidebar-head"><div><span class="panel-eyebrow">CONTROL QUEUE</span><h2 id="queue-title">待处理事项</h2></div><strong>{{ snapshot.attention.length }}</strong></div>
          <div class="queue-list"><article v-for="item in snapshot.attention" :key="item.id" class="queue-item" :class="`level-${item.level}`"><div class="queue-item-top"><i></i><strong>{{ item.title }}</strong><b>{{ item.score }}</b></div><span>{{ item.owner }}</span><p>{{ item.nextAction }}</p><button type="button" @click="activeView = viewForModule(item.module)">处理<el-icon><ArrowRight /></el-icon></button></article></div>
          <div class="source-register"><h3>来源台账</h3><div><span><i class="source-dot-observed"></i>现场证据</span><b>{{ sourceCounts.observed }}</b></div><div><span><i class="source-dot-workbook"></i>历史样表</span><b>{{ sourceCounts.workbook }}</b></div><div><span><i class="source-dot-demo"></i>演示快照</span><b>{{ sourceCounts.demo }}</b></div><div><span><i class="source-dot-pending"></i>待确认</span><b>{{ sourceCounts.pending }}</b></div></div>
        </aside>
      </section>
    </main>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, DataBoard, DocumentChecked, Link, RefreshLeft, Setting, Van, Warning } from '@element-plus/icons-vue'
import {
  JINWEI_ATTENTION_ITEMS,
  JINWEI_COMPLIANCE_STANDARDS,
  JINWEI_DEMO_ORDER,
  JINWEI_DEFAULT_STEP,
  JINWEI_HANDOFFS,
  JINWEI_HISTORICAL_ORDERS,
  JINWEI_MODULE_ROUTES,
  JINWEI_EXTERNAL_RESEARCH,
  JINWEI_ROLES,
  JINWEI_SOURCE_STATUS,
  JINWEI_SPEC_FIELDS,
  JINWEI_TRACE_CHAIN,
  JINWEI_TRACE_SAMPLE,
  JINWEI_WORK_CENTERS,
  JINWEI_WORKFLOW,
  JINWEI_DEMO_STORAGE_KEY,
  JINWEI_SYSTEM_URL,
  createJinweiSnapshot
} from '@/jinwei/model.js'
import { getToken } from '@/utils/auth.js'

const router = useRouter()
const SourceBadge = defineComponent({
  name: 'JinweiSourceBadge',
  props: { status: { type: String, default: 'pending' } },
  setup(props) {
    return () => h('span', { class: ['source-badge', `badge-${props.status}`], title: JINWEI_SOURCE_STATUS[props.status]?.note || '' }, JINWEI_SOURCE_STATUS[props.status]?.label || '待确认')
  }
})

const readState = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(JINWEI_DEMO_STORAGE_KEY) || '{}')
    return { step: Number.isInteger(stored.step) ? stored.step : JINWEI_DEFAULT_STEP, role: JINWEI_ROLES.some((item) => item.id === stored.role) ? stored.role : 'owner', view: ['plan', 'handoffs', 'trace', 'master'].includes(stored.view) ? stored.view : 'plan' }
  } catch {
    return { step: JINWEI_DEFAULT_STEP, role: 'owner', view: 'plan' }
  }
}

const initial = typeof localStorage === 'undefined' ? { step: JINWEI_DEFAULT_STEP, role: 'owner', view: 'plan' } : readState()
const step = ref(initial.step)
const role = ref(initial.role)
const activeView = ref(initial.view)
const selectedWorkflow = ref(initial.step)
const handoffs = ref(JINWEI_HANDOFFS.map((item) => ({ ...item })))
const toastMessage = ref('')
const liveTower = ref(null)
const liveState = ref('loading')

const snapshot = computed(() => createJinweiSnapshot(step.value, role.value))
const effectiveMetrics = computed(() => {
  const local = snapshot.value.metrics
  if (!liveTower.value) return local
  return {
    ...local,
    openHandoffs: Number(liveTower.value.open_handoff_count ?? local.openHandoffs),
    unresolvedSpecs: liveTower.value.specification_status === 'locked' ? 0 : local.unresolvedSpecs,
    finishedPieces: Number(liveTower.value.released_package_count || local.finishedPieces)
  }
})
const liveStateLabel = computed(() => ({
  loading: '正在连接制造数据域…',
  connected: '数据库快照已连接 · 演示数据',
  fallback: '演示边界 · 不写入正式数据'
}[liveState.value] || '演示边界 · 不写入正式数据'))
const roleConfig = computed(() => JINWEI_ROLES.find((item) => item.id === role.value) || JINWEI_ROLES[0])
const selectedStep = computed(() => snapshot.value.workflow[selectedWorkflow.value] || snapshot.value.stage)
const topAttention = computed(() => snapshot.value.attention[0] || { title: '暂无高优先级事项', nextAction: '保持当前流程', owner: '系统', score: 0, sourceStatus: 'demo', module: 'planning' })
const visibleSpecFields = computed(() => JINWEI_SPEC_FIELDS.filter((field) => ['material', 'construction', 'yarnSpec', 'meshSize', 'dimensions', 'color', 'weight', 'packing'].includes(field.key)))
const officialResearch = computed(() => JINWEI_EXTERNAL_RESEARCH.filter((item) => item.tier === 'official'))
const sourceCounts = computed(() => {
  const values = [...JINWEI_SPEC_FIELDS, ...JINWEI_WORKFLOW, ...JINWEI_WORK_CENTERS, ...JINWEI_HANDOFFS, ...JINWEI_TRACE_CHAIN, ...JINWEI_ATTENTION_ITEMS]
  return values.reduce((counts, item) => { const key = item.sourceStatus || 'pending'; counts[key] = (counts[key] || 0) + 1; return counts }, { observed: 0, workbook: 0, demo: 0, pending: 0 })
})

const viewForModule = (module) => ({ planning: 'plan', sales: 'plan', warehouse: 'handoffs', production: 'handoffs', quality: 'trace', equipment: 'master' }[module] || 'plan')
const moduleLabel = (module) => ({ planning: '计划', sales: '销售', warehouse: '仓库', production: '生产', quality: '质检', equipment: '设备' }[module] || module)

const persist = () => { try { localStorage.setItem(JINWEI_DEMO_STORAGE_KEY, JSON.stringify({ step: step.value, role: role.value, view: activeView.value })) } catch {} }
watch([step, role, activeView], persist)

const selectRole = (nextRole) => {
  role.value = nextRole
  const firstModule = roleConfig.value.modules[0]
  activeView.value = viewForModule(firstModule)
}
const advanceWorkflow = () => { if (!snapshot.value.nextAction) return; step.value += 1; selectedWorkflow.value = step.value; ElMessage.success(`演示已推进：${snapshot.value.stage.title}`) }
const resetDemo = () => { step.value = 0; selectedWorkflow.value = 0; activeView.value = 'plan'; handoffs.value = JINWEI_HANDOFFS.map((item) => ({ ...item })); toastMessage.value = ''; ElMessage.success('经纬演示快照已重置') }
const receiveHandoff = (handoff) => { handoff.state = handoff.state === 'outsource' ? 'received' : 'received'; toastMessage.value = `${handoff.code} 已在浏览器演示状态中标记为已接收`; ElMessage.success(toastMessage.value) }
const simulateScan = () => { const next = handoffs.value.find((item) => item.state !== 'received'); if (next) receiveHandoff(next); else ElMessage.info('当前演示交接已全部接收') }
const openModule = (module) => { const route = JINWEI_MODULE_ROUTES[module]; if (route) window.location.assign(route) }

const loadLiveTower = async () => {
  liveState.value = 'loading'
  try {
    const token = getToken()
    const headers = { Accept: 'application/json', 'Accept-Profile': 'jinwei' }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`/api/v_control_tower?order_no=eq.${encodeURIComponent(JINWEI_DEMO_ORDER.orderNo)}&limit=1`, { headers })
    if (!response.ok) throw new Error(`control tower ${response.status}`)
    const rows = await response.json()
    if (!Array.isArray(rows) || !rows[0]) throw new Error('control tower returned no rows')
    liveTower.value = rows[0]
    liveState.value = 'connected'
  } catch {
    liveTower.value = null
    liveState.value = 'fallback'
  }
}

onMounted(loadLiveTower)
</script>

<style scoped>
.jinwei-workbench { --ink:#172722; --muted:#66756e; --paper:#f2f5f2; --surface:#fff; --line:#d9e1dc; --green:#1d6654; --blue:#315d72; --amber:#b67829; --red:#ae4f45; min-height:100vh; padding:20px 24px 38px; color:var(--ink); background:var(--paper); font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC",sans-serif; letter-spacing:0; }
.workbench-header,.boundary-banner,.role-toolbar,.workbench-main { width:min(1540px,100%); margin:0 auto; }
.workbench-header { display:flex; align-items:center; justify-content:space-between; gap:22px; padding-bottom:18px; }
.workbench-brand { display:flex; align-items:center; gap:14px; min-width:0; }
.back-button { display:grid; place-items:center; flex:0 0 auto; width:40px; height:40px; color:var(--green); border:1px solid var(--line); border-radius:4px; background:var(--surface); cursor:pointer; }
.workbench-kicker,.panel-eyebrow,.demo-label { color:var(--green); font:700 10px/1.2 "Arial Narrow",Arial,sans-serif; letter-spacing:1.3px; }
.workbench-kicker { display:flex; align-items:center; gap:6px; color:var(--blue); }
.status-light { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 0 4px rgba(29,102,84,.12); }
.workbench-brand h1 { margin:5px 0 3px; font-size:26px; line-height:1.15; }
.workbench-brand p { margin:0; color:var(--muted); font-size:12px; }
.header-tools { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.environment-chip { padding:7px 10px; color:#7a511d; border:1px solid #dfbd83; border-radius:3px; background:#fff8ed; font-size:10px; white-space:nowrap; }
.header-site-link,.header-reset,.header-next,.header-system-link,.outline-action,.inspector-action,.row-action { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:36px; padding:0 12px; border:1px solid var(--line); border-radius:3px; background:var(--surface); cursor:pointer; font-size:11px; }
.header-site-link,.header-reset { color:var(--green); }
.header-system-link { color:#fff; border-color:var(--blue); background:var(--blue); text-decoration:none; font-weight:700; }
.header-next { color:#fff; border-color:var(--green); background:var(--green); font-weight:700; }
.header-next:disabled { cursor:not-allowed; opacity:.45; }
.boundary-banner { display:flex; align-items:center; justify-content:space-between; gap:18px; min-height:42px; padding:9px 12px; color:#6c4c20; border:1px solid #dfbd83; border-radius:3px; background:#fff8ed; font-size:11px; }
.boundary-banner > div:first-child,.source-key,.source-key span { display:flex; align-items:center; gap:8px; }
.source-key { flex:0 0 auto; gap:14px; color:var(--muted); }
.source-key span { gap:5px; white-space:nowrap; }
.source-key i,.source-register i { width:8px; height:8px; border-radius:50%; }
.source-dot-observed { background:var(--green); }.source-dot-workbook { background:var(--blue); }.source-dot-demo { background:#84958d; }.source-dot-pending { background:var(--amber); }
.role-toolbar { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:16px 0; }
.role-caption { display:grid; grid-template-columns:auto auto; align-items:baseline; gap:3px 8px; min-width:230px; }
.role-caption span,.role-caption small { color:var(--muted); font-size:10px; }.role-caption strong { font-size:14px; }.role-caption small { grid-column:1/-1; }
.role-switch { display:flex; overflow-x:auto; border:1px solid var(--line); border-radius:3px; background:var(--surface); scrollbar-width:thin; }
.role-switch button { flex:0 0 auto; height:35px; min-width:72px; padding:0 13px; color:var(--muted); border:0; border-right:1px solid var(--line); background:transparent; cursor:pointer; font-size:11px; }.role-switch button:last-child{border-right:0}.role-switch button.active{color:#fff;background:var(--green);}
.control-header { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:28px; align-items:center; padding:20px; border:1px solid var(--line); border-radius:5px 5px 0 0; background:var(--surface); }
.identity-line { display:flex; align-items:center; flex-wrap:wrap; gap:9px; }.identity-line code,.trace-code { color:var(--blue); font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace; }.order-identity h2 { margin:8px 0 7px; font-size:22px; }.order-identity p { margin:0; color:var(--muted); font-size:12px; }
.source-badge { display:inline-flex; align-items:center; justify-content:center; min-height:21px; padding:2px 7px; border:1px solid; border-radius:3px; font-size:10px; white-space:nowrap; }.badge-observed{color:var(--green);border-color:#8eb8a9;background:#f0f8f4}.badge-workbook{color:var(--blue);border-color:#93afbd;background:#f0f6f9}.badge-demo{color:#63766d;border-color:#b6c2bc;background:#f3f6f4}.badge-pending{color:var(--amber);border-color:#dfbd83;background:#fff8ed}
.progress-title,.progress-meta { display:flex; align-items:center; justify-content:space-between; gap:10px; }.progress-title { color:var(--muted); font-size:11px; }.progress-title strong { color:var(--green); font-size:20px; }.progress-track { height:7px; margin:8px 0; overflow:hidden; border-radius:2px; background:#e7ece8; }.progress-track i { display:block; height:100%; background:var(--green); transition:width .25s ease; }.progress-meta { color:var(--muted); font-size:10px; }.progress-meta b { color:var(--ink); }
.metrics-row { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); border:1px solid var(--line); border-top:0; background:var(--surface); }.metric { min-height:88px; padding:14px 16px; border-right:1px solid var(--line); }.metric:last-child{border-right:0}.metric span,.metric small{display:block;color:var(--muted);font-size:10px}.metric strong{display:block;margin:7px 0 5px;font-size:23px;color:var(--blue)}.metric-green strong{color:var(--green)}.metric-focus strong,.metric-warning strong{color:var(--amber)}.metric small{font-size:10px}
.workflow-panel { margin-top:14px; border:1px solid var(--line); border-radius:5px; background:var(--surface); overflow:hidden; }.panel-heading,.content-heading,.sidebar-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }.panel-heading { padding:17px 18px 0; }.panel-heading h2,.content-heading h2,.sidebar-head h2 { margin:4px 0 0; font-size:16px; }.current-stage { display:grid; justify-items:end; gap:4px; color:var(--muted); font-size:10px; }.current-stage strong{color:var(--ink);font-size:12px}.workflow-scroll{overflow-x:auto;padding:22px 18px 8px;scrollbar-width:thin}.workflow-rail{position:relative;display:grid;grid-template-columns:repeat(9,minmax(90px,1fr));min-width:900px}.workflow-rail::before{content:"";position:absolute;top:18px;right:5%;left:5%;height:3px;background:var(--line)}.workflow-node{position:relative;z-index:1;display:grid;justify-items:center;gap:4px;padding:0 3px 9px;color:var(--muted);border:0;background:transparent;cursor:pointer;font-size:10px}.workflow-node:focus-visible,.role-switch button:focus-visible,.workspace-tabs button:focus-visible,.queue-item button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}.node-circle{display:grid;place-items:center;width:37px;height:37px;color:var(--muted);border:2px solid var(--line);border-radius:50%;background:var(--surface);font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace}.workflow-node.is-done .node-circle{color:#fff;border-color:var(--green);background:var(--green)}.workflow-node.is-active .node-circle{color:#fff;border-color:var(--amber);background:var(--amber);box-shadow:0 0 0 4px rgba(182,120,41,.14)}.workflow-node.selected::after{content:"";position:absolute;right:18%;bottom:0;left:18%;height:2px;background:var(--blue)}.workflow-node small{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.workflow-node strong{font-size:11px;white-space:nowrap}.workflow-inspector{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:92px;padding:14px 18px;border-top:1px solid var(--line);background:#f8faf8}.inspector-module{color:var(--blue);font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace}.workflow-inspector h3{margin:4px 0;font-size:14px}.workflow-inspector p{margin:0;color:var(--muted);font-size:11px;line-height:1.5}.inspector-action{flex:0 0 auto;color:var(--green);border-color:#a8c3b8}
.attention-focus{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(2,minmax(150px,.45fr));gap:10px;margin-top:14px}.focus-card{padding:15px 17px;color:#fff;border-radius:4px;background:#24372f}.focus-card-label{display:flex;align-items:center;gap:7px;color:#c4d8cf;font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace}.priority-pip{width:8px;height:8px;border-radius:50%;background:#f0b849;box-shadow:0 0 0 4px rgba(240,184,73,.16)}.focus-card-content{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-top:12px}.focus-card h2{margin:0;font-size:16px}.focus-card-content p{max-width:650px;margin:5px 0 0;color:#c4d8cf;font-size:11px;line-height:1.5}.focus-card-content>strong{color:#f0b849;font-size:23px}.focus-card-foot{display:flex;align-items:center;gap:10px;margin-top:12px;color:#b7cbc1;font-size:10px}.focus-card-foot button{margin-left:auto;padding:0;color:#fff;border:0;background:transparent;font-size:10px}.attention-summary{display:grid;align-content:center;gap:5px;padding:15px;border:1px solid var(--line);border-radius:4px;background:var(--surface)}.attention-summary span,.attention-summary small{color:var(--muted);font-size:10px}.attention-summary strong{font-size:25px;color:var(--blue)}
.workspace-grid{display:grid;grid-template-columns:minmax(0,1fr) 316px;align-items:start;gap:14px;margin-top:14px}.workspace-panel,.attention-sidebar{min-width:0;border:1px solid var(--line);border-radius:5px;background:var(--surface);overflow:hidden}.workspace-tabs{display:flex;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:thin}.workspace-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;min-width:132px;height:46px;padding:0 14px;color:var(--muted);border:0;border-right:1px solid var(--line);background:transparent;cursor:pointer;font-size:11px}.workspace-tabs button.active{color:var(--green);box-shadow:inset 0 -3px var(--green);background:#f5faf7}.workspace-content{min-height:500px;padding:20px}.content-heading{margin-bottom:17px}.content-heading p{margin:5px 0 0;color:var(--muted);font-size:11px;line-height:1.5}.version-chip,.trace-code{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid #a7bdc7;border-radius:3px;background:#f1f7f9}.outline-action{color:var(--green);border-color:#a8c3b8}.spec-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}.spec-summary-cell{position:relative;display:grid;gap:6px;min-height:130px;padding:12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.spec-summary-cell>span{color:var(--muted);font-size:10px}.spec-summary-cell strong{font-size:13px;line-height:1.35}.spec-summary-cell small{min-height:30px;color:var(--muted);font-size:10px;line-height:1.45}.spec-summary-cell .source-badge{width:fit-content}.spec-summary-cell.pending{background:#fffaf1}.subheading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:23px 0 10px}.subheading h3{margin:0;font-size:13px}.subheading span{color:var(--muted);font-size:10px}.historical-table-wrap{overflow:auto;border-top:1px solid var(--line)}.historical-table{width:100%;min-width:820px;border-collapse:collapse;font-size:10px}.historical-table th{padding:9px 8px;color:var(--muted);text-align:left;background:#f6f8f6;font-weight:650}.historical-table td{padding:11px 8px;vertical-align:top;border-top:1px solid var(--line);line-height:1.45}.historical-table td strong,.historical-table td small{display:block}.historical-table td small{margin-top:3px;color:var(--muted);font-size:9px}.mobile-records{display:none}
.handoff-list{border-top:1px solid var(--line)}.handoff-row{display:grid;grid-template-columns:130px minmax(130px,.8fr) minmax(170px,1.2fr) 70px auto;align-items:center;gap:12px;min-height:72px;padding:10px 3px;border-bottom:1px solid var(--line)}.handoff-code{display:grid;gap:3px}.handoff-code span{color:var(--muted);font:9px ui-monospace,SFMono-Regular,Menlo,monospace}.handoff-code strong{color:var(--blue);font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.handoff-route{display:flex;align-items:center;gap:7px;font-size:11px}.handoff-route b{color:var(--amber)}.handoff-item{display:grid;gap:3px}.handoff-item strong{font-size:12px}.handoff-item small{color:var(--muted);font-size:10px}.row-action{color:var(--green);border-color:#a8c3b8;white-space:nowrap}.received-label{display:inline-flex;align-items:center;gap:4px;color:var(--green);font-size:10px;white-space:nowrap}.handoff-outsource{background:#fffaf1}.handoff-rule,.trace-note{display:flex;align-items:flex-start;gap:8px;margin-top:15px;padding:11px 12px;color:#72501e;border:1px solid #dfbd83;background:#fff8ed;font-size:10px;line-height:1.5}.handoff-rule .el-icon,.trace-note .el-icon{flex:0 0 auto;color:var(--amber);font-size:16px}
.trace-header{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:21px;border:1px solid var(--line)}.trace-header>div{display:grid;gap:6px;padding:12px;border-right:1px solid var(--line)}.trace-header>div:last-child{border-right:0}.trace-header span{color:var(--muted);font-size:10px}.trace-header strong{font-size:11px;line-height:1.35}.trace-chain{position:relative;display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));margin:0;padding:0;list-style:none;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow-x:auto;min-width:720px}.trace-chain::before{content:"";position:absolute;top:20px;right:6%;left:6%;height:2px;background:var(--line)}.trace-chain li{position:relative;z-index:1;display:grid;align-content:start;gap:8px;min-height:190px;padding:13px 10px;border-right:1px solid var(--line);background:var(--surface)}.trace-chain li:last-child{border-right:0}.trace-no{display:grid;place-items:center;width:25px;height:25px;color:#fff;border-radius:50%;background:var(--blue);font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace}.trace-chain li>div{display:grid;gap:6px}.trace-chain li strong{font-size:11px}.trace-chain li code{color:var(--green);font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}.trace-chain li small{color:var(--muted);font-size:9px;line-height:1.5}.trace-chain .source-badge{width:fit-content}.trace-pending{background:#fffaf1!important}
.center-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.center-card{padding:14px;border:1px solid var(--line);background:#fbfcfb}.center-card-top{display:flex;align-items:center;justify-content:space-between}.center-index{color:var(--blue);font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace}.center-card h3{margin:15px 0 7px;font-size:13px}.center-card p{min-height:35px;margin:0;color:var(--muted);font-size:10px;line-height:1.5}.center-card small{display:block;margin-top:12px;padding-top:9px;border-top:1px solid var(--line);color:var(--muted);font-size:10px;line-height:1.5}.center-card small strong{color:var(--ink)}.capture-order{display:grid;gap:5px;margin-top:18px;padding:14px;color:#d6e2dc;background:#24372f}.capture-order span{color:#a8c4b8;font-size:10px}.capture-order strong{font-size:12px;line-height:1.5}.capture-order small{color:#b7cbc1;font-size:10px}
.standards-panel{margin-top:18px;border-top:1px solid var(--line);padding-top:18px}.standards-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.standards-heading h3{margin:4px 0 0;font-size:14px}.standards-heading p{margin:5px 0 0;color:var(--muted);font-size:10px;line-height:1.5}.standards-boundary{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:6px 8px;color:#7a511d;border:1px solid #dfbd83;background:#fff8ed;font-size:10px;white-space:nowrap}.standards-boundary .el-icon{font-size:13px}.standards-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.standard-card{display:grid;gap:7px;padding:11px 12px;border:1px solid var(--line);background:#fbfcfb}.standard-top,.standard-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}.standard-top code{color:var(--blue);font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace}.standard-current{display:inline-flex;align-items:center;gap:4px;color:var(--green);font-size:10px}.standard-current i{width:6px;height:6px;border-radius:50%;background:var(--green)}.standard-card h4{margin:0;font-size:11px;line-height:1.4}.standard-card p{min-height:29px;margin:0;color:var(--muted);font-size:10px;line-height:1.45}.standard-foot{padding-top:7px;border-top:1px solid var(--line);color:var(--muted);font-size:9px}.standard-foot a,.research-register a{display:inline-flex;align-items:center;gap:4px;color:var(--green);text-decoration:none;white-space:nowrap}.standard-foot a:hover,.research-register a:hover{text-decoration:underline}.research-register{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 11px;color:#72501e;border:1px solid #dfbd83;background:#fff8ed;font-size:10px;line-height:1.5}.research-register>span{display:flex;align-items:flex-start;gap:6px}.research-register .el-icon{flex:0 0 auto;margin-top:1px;color:var(--amber);font-size:14px}
.attention-sidebar{position:sticky;top:14px}.sidebar-head{align-items:center;padding:16px;color:#fff;background:#24372f}.sidebar-head h2{color:#fff}.sidebar-head .panel-eyebrow{color:#a8c4b8}.sidebar-head>strong{display:grid;place-items:center;width:35px;height:35px;border:1px solid #627b70;border-radius:50%;font-size:15px}.queue-list{padding:4px 14px}.queue-item{position:relative;padding:13px 0 13px 14px;border-bottom:1px solid var(--line)}.queue-item>i{position:absolute;top:17px;left:0;width:7px;height:7px;border-radius:50%;background:var(--amber)}.queue-item.level-critical>i{background:var(--red)}.queue-item.level-warning>i{background:var(--amber)}.queue-item.level-focus>i{background:var(--blue)}.queue-item-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}.queue-item-top>strong{font-size:12px;line-height:1.35}.queue-item-top>b{color:var(--amber);font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace}.queue-item>span{display:block;margin-top:4px;color:var(--muted);font-size:10px}.queue-item p{margin:6px 0 8px;color:var(--muted);font-size:10px;line-height:1.5}.queue-item button{display:inline-flex;align-items:center;gap:4px;padding:0;color:var(--green);border:0;background:transparent;font-size:10px}.source-register{padding:14px;background:#f7f9f7}.source-register h3{margin:0 0 9px;font-size:12px}.source-register>div{display:flex;align-items:center;justify-content:space-between;min-height:27px;color:var(--muted);font-size:10px}.source-register span{display:flex;align-items:center;gap:7px}.source-register b{color:var(--ink)}
@media (max-width:1100px){.workbench-header{align-items:flex-start;flex-direction:column}.header-tools{width:100%;justify-content:flex-start;flex-wrap:wrap}.control-header{grid-template-columns:1fr}.attention-focus{grid-template-columns:minmax(0,1fr) repeat(2,minmax(130px,.45fr))}.workspace-grid{grid-template-columns:minmax(0,1fr) 270px}.handoff-row{grid-template-columns:110px minmax(110px,.8fr) minmax(150px,1.2fr) auto}.handoff-row .source-badge{display:none}}
@media (max-width:780px){.jinwei-workbench{padding:12px 10px 25px}.workbench-brand h1{font-size:22px}.workbench-brand p{font-size:11px}.boundary-banner{align-items:flex-start;flex-direction:column;gap:8px}.source-key{width:100%;justify-content:space-between}.role-toolbar{align-items:flex-start;flex-direction:column}.role-switch{width:100%}.role-switch button{min-width:64px;padding:0 10px}.control-header{padding:15px}.order-identity h2{font-size:19px}.metrics-row{grid-template-columns:repeat(2,minmax(0,1fr))}.metric{border-bottom:1px solid var(--line)}.metric:nth-child(even){border-right:0}.metric:last-child{grid-column:1/-1;border-right:0}.workflow-panel{border-radius:4px}.panel-heading{padding:14px 12px 0}.workflow-scroll{padding-right:10px;padding-left:10px}.workflow-rail{min-width:840px}.workflow-inspector{align-items:flex-start;flex-direction:column;padding:13px 12px}.inspector-action{width:100%}.attention-focus{grid-template-columns:1fr}.attention-summary{min-height:75px}.workspace-grid{grid-template-columns:1fr}.attention-sidebar{position:static}.workspace-content{padding:14px 12px}.content-heading{align-items:flex-start;flex-direction:column}.spec-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.spec-summary-cell{min-height:145px}.historical-table-wrap{display:none}.mobile-records{display:grid;border-top:1px solid var(--line)}.mobile-records article{display:grid;gap:5px;padding:12px 2px;border-bottom:1px solid var(--line)}.mobile-records article>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.mobile-records span{font-size:11px}.mobile-records small{color:var(--muted);font-size:10px;line-height:1.45}.handoff-row{grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:12px 2px}.handoff-route{grid-column:1/-1;order:2}.handoff-item{grid-column:1/-1;order:3}.handoff-row>.source-badge{display:inline-flex;order:4;width:fit-content}.handoff-row>.row-action,.received-label{grid-column:2;grid-row:1;order:5}.trace-header{grid-template-columns:repeat(2,minmax(0,1fr))}.trace-header>div:nth-child(2){border-right:0}.trace-header>div:nth-child(-n+2){border-bottom:1px solid var(--line)}.trace-chain{margin-right:-12px;margin-left:-12px;padding-left:12px}.center-grid{grid-template-columns:1fr}.standards-heading{align-items:flex-start;flex-direction:column}.standards-boundary{white-space:normal}.standards-grid{grid-template-columns:1fr}.research-register{align-items:flex-start;flex-direction:column}.header-tools{gap:6px}.environment-chip{width:100%}.header-next,.header-site-link,.header-reset,.header-system-link{min-height:34px}}
@media (prefers-reduced-motion:reduce){.progress-track i{transition:none}}
</style>
