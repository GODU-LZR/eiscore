<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (c) 2026 林志荣
-->

<template>
  <main class="landing-page" :data-lang="lang">
    <header class="site-header">
      <a class="brand" href="#hero" aria-label="EISCore product landing">
        <span class="brand-mark">E</span>
        <span class="brand-text">
          <strong>EISCore</strong>
          <small>{{ page.header.subtitle }}</small>
        </span>
      </a>

      <nav class="nav-links" aria-label="EISCore landing navigation">
        <a v-for="item in page.nav" :key="item.href" :href="item.href">{{ item.label }}</a>
      </nav>

      <div class="language-switch" aria-label="Language switch">
        <button type="button" :class="{ active: lang === 'zh' }" @click="setLang('zh')">中文</button>
        <button type="button" :class="{ active: lang === 'en' }" @click="setLang('en')">EN</button>
      </div>
    </header>

    <section id="hero" class="hero section-shell" data-reveal>
      <div class="hero-copy">
        <p class="eyebrow">{{ page.hero.kicker }}</p>
        <h1>
          <span>EISCore</span>
          {{ page.hero.title }}
        </h1>
        <p class="hero-subtitle">{{ page.hero.subtitle }}</p>

        <div class="hero-actions">
          <a class="btn btn-primary" href="#solution">{{ page.hero.ctas.product }}</a>
          <a class="btn btn-secondary" href="#architecture">{{ page.hero.ctas.architecture }}</a>
          <a class="btn btn-plain" href="#license">{{ page.hero.ctas.license }}</a>
        </div>

        <dl class="hero-stats" aria-label="Project evidence">
          <div v-for="item in page.hero.stats" :key="item.value">
            <dt>{{ item.value }}</dt>
            <dd>{{ item.label }}</dd>
          </div>
        </dl>
      </div>

      <aside class="capability-panel" aria-label="EISCore capability overview">
        <div class="panel-header">
          <span>{{ page.hero.panel.title }}</span>
          <strong>{{ page.hero.panel.status }}</strong>
        </div>

        <div class="panel-diagram" aria-hidden="true">
          <div class="core-node">
            <small>{{ page.hero.panel.coreLabel }}</small>
            <strong>EISCore Core</strong>
          </div>
          <svg viewBox="0 0 520 260" role="img" aria-label="EISCore capability diagram">
            <defs>
              <linearGradient id="lineGoldBlue" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stop-color="#e8c36a" />
                <stop offset="55%" stop-color="#7c5cff" />
                <stop offset="100%" stop-color="#3dd6e8" />
              </linearGradient>
            </defs>
            <path d="M260 130 L110 58" />
            <path d="M260 130 L410 58" />
            <path d="M260 130 L92 202" />
            <path d="M260 130 L428 202" />
            <path d="M260 130 L260 38" />
            <path d="M260 130 L260 222" />
            <circle cx="260" cy="130" r="44" class="svg-core" />
            <circle cx="110" cy="58" r="7" />
            <circle cx="410" cy="58" r="7" />
            <circle cx="92" cy="202" r="7" />
            <circle cx="428" cy="202" r="7" />
            <circle cx="260" cy="38" r="7" />
            <circle cx="260" cy="222" r="7" />
          </svg>
        </div>

        <div class="panel-grid">
          <article v-for="item in page.hero.panel.items" :key="item.title">
            <span>{{ item.code }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>
      </aside>
    </section>

    <section class="section section-shell" data-reveal>
      <div class="section-heading">
        <p class="eyebrow">{{ page.pain.kicker }}</p>
        <h2>{{ page.pain.title }}</h2>
        <p>{{ page.pain.lead }}</p>
      </div>

      <div class="grid grid-four">
        <article v-for="item in page.pain.items" :key="item.title" class="info-card">
          <span class="number-label">{{ item.index }}</span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </article>
      </div>
    </section>

    <section id="solution" class="section section-muted" data-reveal>
      <div class="section-shell">
        <div class="split-heading">
          <div>
            <p class="eyebrow">{{ page.solution.kicker }}</p>
            <h2>{{ page.solution.title }}</h2>
          </div>
          <p>{{ page.solution.lead }}</p>
        </div>

        <div class="solution-layout">
          <div class="solution-chain" aria-label="EISCore solution chain">
            <article v-for="(item, index) in page.solution.chain" :key="item">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              {{ item }}
            </article>
          </div>

          <div class="grid grid-three">
            <article v-for="item in page.solution.items" :key="item.title" class="feature-card">
              <span>{{ item.code }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section id="codebase" class="section section-shell" data-reveal>
      <div class="section-heading wide align-left">
        <p class="eyebrow">{{ page.codebase.kicker }}</p>
        <h2>{{ page.codebase.title }}</h2>
        <p>{{ page.codebase.lead }}</p>
      </div>

      <div class="module-board">
        <article v-for="item in page.codebase.items" :key="item.title" class="module-card">
          <div class="module-meta">
            <span>{{ item.badge }}</span>
            <small>{{ item.state }}</small>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </article>
      </div>
    </section>

    <section class="section section-muted" data-reveal>
      <div class="section-shell scenario-layout">
        <div class="section-heading align-left">
          <p class="eyebrow">{{ page.scenarios.kicker }}</p>
          <h2>{{ page.scenarios.title }}</h2>
          <p>{{ page.scenarios.lead }}</p>
        </div>

        <div class="scenario-board">
          <article v-for="item in page.scenarios.items" :key="item.title">
            <span>{{ item.index }}</span>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-shell" data-reveal>
      <div class="section-heading wide">
        <p class="eyebrow">{{ page.platform.kicker }}</p>
        <h2>{{ page.platform.title }}</h2>
        <p>{{ page.platform.lead }}</p>
      </div>

      <div class="platform-window">
        <div class="window-top">
          <span></span>
          <span></span>
          <span></span>
          <strong>{{ page.platform.windowTitle }}</strong>
        </div>
        <div class="platform-content">
          <div class="platform-main">
            <article v-for="item in page.platform.items" :key="item.title">
              <strong>{{ item.title }}</strong>
              <p>{{ item.text }}</p>
            </article>
          </div>
          <aside class="platform-steps">
            <strong>{{ page.platform.sideTitle }}</strong>
            <ol>
              <li v-for="step in page.platform.steps" :key="step">{{ step }}</li>
            </ol>
          </aside>
        </div>
      </div>
    </section>

    <section id="architecture" class="section section-muted" data-reveal>
      <div class="section-shell">
        <div class="section-heading wide">
          <p class="eyebrow">{{ page.architecture.kicker }}</p>
          <h2>{{ page.architecture.title }}</h2>
          <p>{{ page.architecture.lead }}</p>
        </div>

        <div class="architecture-frame">
          <article v-for="(item, index) in page.architecture.layers" :key="item.title">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>

        <div class="tech-tags" aria-label="Technology stack">
          <span v-for="item in page.architecture.tech" :key="item">{{ item }}</span>
        </div>
      </div>
    </section>

    <section class="section section-shell" data-reveal>
      <div class="practice-panel">
        <div>
          <p class="eyebrow">{{ page.practice.kicker }}</p>
          <h2>{{ page.practice.title }}</h2>
          <p>{{ page.practice.text }}</p>
          <p class="disclaimer">{{ page.practice.disclaimer }}</p>
        </div>
        <div class="tag-cloud" aria-label="Industry practice labels">
          <span v-for="tag in page.practice.tags" :key="tag">{{ tag }}</span>
        </div>
      </div>
    </section>

    <section id="license" class="section section-muted" data-reveal>
      <div class="section-shell license-layout">
        <div>
          <p class="eyebrow">{{ page.license.kicker }}</p>
          <h2>{{ page.license.title }}</h2>
          <ul>
            <li v-for="item in page.license.items" :key="item">{{ item }}</li>
          </ul>
        </div>

        <aside class="terminal-panel" aria-label="Open source and commercial boundary">
          <div class="terminal-top">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <pre><code>License: AGPL-3.0-or-later
Docs: CC BY-NC-SA 4.0
Commercial Use: Written authorization required
Owner: 林志荣</code></pre>
        </aside>
      </div>
    </section>

    <footer class="site-footer">
      <div class="section-shell footer-inner">
        <div>
          <strong>EISCore</strong>
          <p>Copyright (c) 2026 林志荣</p>
        </div>
        <div class="footer-links">
          <span>License: AGPL-3.0-or-later</span>
          <span>Docs: CC BY-NC-SA 4.0</span>
          <a href="#architecture">{{ page.footer.documentation }}</a>
          <a href="#license">{{ page.footer.commercial }}</a>
          <a href="#codebase">{{ page.footer.evidence }}</a>
        </div>
      </div>
    </footer>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const lang = ref('zh')
let revealObserver

const content = {
  zh: {
    header: {
      subtitle: '产品介绍页'
    },
    nav: [
      { label: '产品能力', href: '#solution' },
      { label: '代码工程', href: '#codebase' },
      { label: '技术架构', href: '#architecture' },
      { label: '授权边界', href: '#license' }
    ],
    hero: {
      kicker: 'AI SaaS / Manufacturing Digital Core',
      title: '面向中小制造企业的 AI+企业信息化底座',
      subtitle: '从真实制造业数字化实施与二次定制经验中沉淀，围绕人员、物料、库存、流程、数据和现场作业，构建一套轻量、可扩展、可追溯的企业信息化核心平台。',
      ctas: {
        product: '查看产品能力',
        architecture: '查看技术架构',
        license: '开源与商业授权'
      },
      stats: [
        { value: '多业务子应用', label: 'Base / HR / WMS / Apps / Mobile / Sales / Purchase / Production' },
        { value: 'PostgreSQL 16', label: 'Schema / RLS / RPC / Views / Triggers' },
        { value: 'Agent Runtime', label: 'WebSocket / Knowledge QA / Tool Calling' }
      ],
      panel: {
        title: 'Product Capability Map',
        status: 'runnable prototype',
        coreLabel: 'traceable data chain',
        items: [
          { code: 'DB', title: 'Database Core', text: '数据、权限、函数、状态和审计沉淀到底座。' },
          { code: 'MF', title: 'Micro Frontends', text: '基座统一入口，业务域独立演进。' },
          { code: 'WF', title: 'Workflow', text: 'BPMN 流程与业务状态写回联动。' },
          { code: 'SE', title: 'Semantic Layer', text: '表、字段、关系语义增强可解释性。' },
          { code: 'AI', title: 'Agent Runtime', text: '知识库问答、事件流和受控工具调用。' },
          { code: 'MO', title: 'Mobile Workbench', text: '扫码、盘点、标签和现场数据采集。' }
        ]
      }
    },
    pain: {
      kicker: 'Manufacturing Pain Points',
      title: '中小制造企业数字化，不只是“上系统”',
      lead: '真正难的是把订单、库存、流程、质检和现场动作组织成统一的数据链路，并且能持续扩展。',
      items: [
        { index: '01', title: '业务数据分散', text: '纸单、Excel、微信群和独立系统并存，数据反复转录，口径难统一。' },
        { index: '02', title: '批次追溯困难', text: '原料、库存、质检、领料、补料和发货记录难以串成完整链路。' },
        { index: '03', title: '流程协同依赖人工', text: '审批、状态变更、异常补录和现场确认常靠人工提醒与线下沟通。' },
        { index: '04', title: '系统上线后难扩展', text: '轻量工具上线快，但字段、流程、权限和跨模块协同会随业务增长变复杂。' }
      ]
    },
    solution: {
      kicker: 'EISCore Solution',
      title: '把业务、流程、数据和 AI 收回同一条链路',
      lead: 'EISCore 不是把多个页面拼在一起，而是用数据库中心架构、微前端模块、工作流状态映射和语义治理，把企业信息化项目中最容易断裂的链路沉淀成底座能力。',
      chain: ['业务表单', '流程审批', '库存台账', '移动作业', '语义解释', '智能体辅助'],
      items: [
        { code: 'DB', title: '数据库中心架构', text: '把核心数据、权限、状态、函数和审计能力沉淀到底座，减少业务逻辑散落。' },
        { code: 'MF', title: '微前端模块化', text: '基座门户统一入口，业务子应用按人事、物料、应用中心、销售、采购、生产等域独立演进。' },
        { code: 'WF', title: '流程状态联动', text: 'BPMN 流程与业务状态映射，让审批、发布和流转结果回到业务数据。' },
        { code: 'SE', title: '轻量语义治理', text: '用表级、列级、关系语义解释业务对象，为配置、报表和智能体调用提供上下文。' },
        { code: 'MO', title: '移动端现场作业', text: '支持扫码、盘点、标签打印、仓库查询和移动数据上报等一线作业场景。' },
        { code: 'AI', title: '智能体辅助配置', text: '通过知识库问答、工具调用、事件流和配置辅助，提高系统解释和应用搭建效率。' }
      ]
    },
    codebase: {
      kicker: 'Real Codebase Capabilities',
      title: '不是单页 Demo，而是一套多模块代码工程',
      lead: '当前代码库已经形成基座门户、人事、物料、应用中心、移动端、销售、采购、生产、实时智能体和数据库脚本等模块基础。核心模块已形成可运行原型，部分业务域处于扩展实现阶段。',
      items: [
        { badge: 'Base', state: '已形成', title: 'Base Portal', text: '统一入口、登录、设置、微前端容器、企业 AI 入口和多业务子应用注册。' },
        { badge: 'HR', state: '已形成', title: 'HR / HMS', text: '员工、组织架构、权限、用户管理、考勤、字段权限和角色数据范围。' },
        { badge: 'WMS', state: '已形成', title: 'Materials / Inventory', text: '物料主数据、批号规则、仓库、库存台账、入库、出库、盘点、标签和 BOM。' },
        { badge: 'Apps', state: '已形成', title: 'App Center', text: '数据应用、流程设计、审批中心、配置中心、本体关系工作台、运行预览和发布路由。' },
        { badge: 'Mobile', state: '已形成', title: 'Mobile Workbench', text: 'PDA、扫码、仓库查询、盘点、库存扫描、标签打印、考勤和移动助手。' },
        { badge: 'Sales', state: '扩展中', title: 'Sales', text: '客户、跟进、商机、订单、回款、销售看板和销售驾驶舱代码结构。' },
        { badge: 'Purchase', state: '扩展中', title: 'Purchase', text: '供应商、需求、订单、到货、采购单据详情、业务流状态和采购看板。' },
        { badge: 'MFG', state: '扩展中', title: 'Production', text: 'BOM、生产应用入口、生产看板，并配套 BOM 展开、MRP 和工单 SQL。' },
        { badge: 'Agent', state: '已形成', title: 'Realtime / Agent Runtime', text: 'WebSocket、知识库问答、工具调用、事件流、BPMN 引擎集成和 Flash 工具通道。' },
        { badge: 'SQL', state: '已形成', title: 'SQL / Database', text: 'app_center、workflow、inventory、twin、BOM、RLS、视图、函数、触发器和初始化脚本。' }
      ]
    },
    scenarios: {
      kicker: 'Manufacturing Scenarios',
      title: '面向多批次、小批量、强追溯现场',
      lead: '页面叙事更靠近真实制造业数字化：围绕订单、物料、库存、质检、生产和发货数据，把现场动作变成可查询、可解释、可追溯的业务记录。',
      items: [
        { index: 'A', title: '多批次原料管理', text: '批号规则、入库、库存台账和批次状态协同。' },
        { index: 'B', title: '保质期与先进先出', text: '围绕生产日期、有效期和仓库位置组织库存使用。' },
        { index: 'C', title: '生产领料与补料', text: '把领料、补料和库存变动接入业务记录。' },
        { index: 'D', title: '质检附件与延迟补录', text: '兼容现场补录、附件和后续追溯解释。' },
        { index: 'E', title: '销售发货与物流信息', text: '销售、出库、发货和业务流状态可以持续扩展。' },
        { index: 'F', title: '正向/反向追溯', text: '从批次到单据，从单据回到原料和库存来源。' },
        { index: 'G', title: '移动盘点与标签打印', text: 'PDA、扫码、盘点、标签和仓库查询面向现场使用。' },
        { index: 'H', title: '审批与状态写回', text: '流程动作不只停留在流程系统，而是回写业务状态。' }
      ]
    },
    platform: {
      kicker: 'Platform Capability',
      title: '从业务表单到企业应用底座',
      lead: 'EISCore 的应用中心更接近面向企业内部数字化的轻量应用搭建平台，兼顾表单、表格、流程、语义和受控智能体。',
      windowTitle: 'App Center / Data Apps / Workflow',
      sideTitle: '典型搭建链路',
      steps: ['定义数据表与字段', '配置表格、表单和权限', '绑定流程与状态映射', '发布路由并接入移动端', '用语义和 Agent 辅助解释'],
      items: [
        { title: '应用中心', text: '统一管理数据应用、配置中心、运行预览和发布入口。' },
        { title: '数据应用配置', text: '围绕业务表构建可配置的表格、表单和字段展示。' },
        { title: '流程设计', text: '支持 BPMN 流程设计和业务状态映射。' },
        { title: '审批中心', text: '把流程任务、审批动作和业务状态联动起来。' },
        { title: '语义关系工作台', text: '管理对象、字段、关系语义，提升系统可解释性。' },
        { title: '受控 Agent Runtime', text: '通过工具注册、工具调用和事件流辅助配置与问答。' }
      ]
    },
    architecture: {
      kicker: 'Technical Architecture',
      title: '为低运维成本而设计',
      lead: '技术选型围绕轻量部署、明确边界和持续扩展展开，让中小制造企业数字化项目可以从核心链路逐步生长。',
      layers: [
        { title: 'Frontend Shell', text: 'Vue 3 / Vite / qiankun，基座统一入口并加载多业务子应用。' },
        { title: 'Data API', text: 'PostgREST / RPC / WebSocket，提供数据接口、流程动作和实时事件。' },
        { title: 'Database Core', text: 'PostgreSQL 16 / RLS / Schema / Functions / Triggers，沉淀权限、状态与业务约束。' },
        { title: 'Intelligence Layer', text: 'Semantic Layer / Agent Runtime / Knowledge QA / Tool Calling，提供受控智能辅助。' }
      ],
      tech: ['Vue 3', 'Vite', 'qiankun', 'Element Plus', 'Vant', 'PostgreSQL 16', 'PostgREST', 'RLS', 'BPMN', 'WebSocket', 'Docker Compose', 'Agent Runtime']
    },
    practice: {
      kicker: 'Practice Origin',
      title: '来自真实项目实施与二次定制的一线经验',
      text: 'EISCore 的设计来源于作者参与中小制造企业数字化项目实施、二次定制、需求调研与系统交付过程中沉淀的共性问题。',
      disclaimer: '部分实践经验来源于作者参与的企业数字化实施与二次定制工作，相关表述仅用于说明行业经验来源，不代表相关企业或机构对 EISCore 的商业背书、采购确认或正式授权案例。',
      tags: ['水产加工', '食品制造', '罐头加工', '生物制品', '农产品加工', '仓储物流', '质量追溯', '移动盘点', '生产计划', '通信生态协同']
    },
    license: {
      kicker: 'Open Source Boundary',
      title: '开放代码，但保留清晰商业边界',
      items: [
        'EISCore 代码采用 AGPL-3.0-or-later 协议开源。',
        '文档材料可按 CC BY-NC-SA 4.0 协议公开。',
        '开源发布不构成著作权转让、买断、职务作品确认、委托开发成果归属确认、独占授权或权利放弃。',
        '商业闭源交付、政府产品申报、软著登记、产品权属申报、SaaS/私有化部署且不履行 AGPL 的使用，需要版权人书面授权。'
      ]
    },
    footer: {
      documentation: 'Documentation',
      commercial: 'Commercial License',
      evidence: 'Thesis Evidence'
    }
  },
  en: {
    header: {
      subtitle: 'Product Landing'
    },
    nav: [
      { label: 'Capabilities', href: '#solution' },
      { label: 'Codebase', href: '#codebase' },
      { label: 'Architecture', href: '#architecture' },
      { label: 'License', href: '#license' }
    ],
    hero: {
      kicker: 'AI SaaS / Manufacturing Digital Core',
      title: 'AI-powered Enterprise Informatization Core for SME Manufacturing',
      subtitle: 'Distilled from real manufacturing digitalization and secondary customization work, EISCore connects people, materials, inventory, workflow, data, and field operations into a lightweight, extensible, and traceable enterprise informatization core.',
      ctas: {
        product: 'Explore Capabilities',
        architecture: 'View Architecture',
        license: 'Open Source and Commercial Use'
      },
      stats: [
        { value: 'Multi-app codebase', label: 'Base / HR / WMS / Apps / Mobile / Sales / Purchase / Production' },
        { value: 'PostgreSQL 16', label: 'Schema / RLS / RPC / Views / Triggers' },
        { value: 'Agent Runtime', label: 'WebSocket / Knowledge QA / Tool Calling' }
      ],
      panel: {
        title: 'Product Capability Map',
        status: 'runnable prototype',
        coreLabel: 'traceable data chain',
        items: [
          { code: 'DB', title: 'Database Core', text: 'Data, permissions, functions, status, and audit context in the core.' },
          { code: 'MF', title: 'Micro Frontends', text: 'One portal with business domains evolving independently.' },
          { code: 'WF', title: 'Workflow', text: 'BPMN workflow connected with business status write-back.' },
          { code: 'SE', title: 'Semantic Layer', text: 'Table, field, and relation semantics for explainability.' },
          { code: 'AI', title: 'Agent Runtime', text: 'Knowledge QA, event streams, and controlled tool calls.' },
          { code: 'MO', title: 'Mobile Workbench', text: 'Scanning, stocktaking, labels, and field data capture.' }
        ]
      }
    },
    pain: {
      kicker: 'Manufacturing Pain Points',
      title: 'Digitalization for SME manufacturing is more than installing software',
      lead: 'The real challenge is organizing orders, inventory, workflow, quality, and field actions into one data chain that can keep evolving.',
      items: [
        { index: '01', title: 'Scattered business data', text: 'Paper forms, spreadsheets, chat groups, and isolated systems make data repeated and inconsistent.' },
        { index: '02', title: 'Difficult batch traceability', text: 'Raw materials, inventory, quality checks, material issue, replenishment, and delivery records are hard to connect.' },
        { index: '03', title: 'Manual workflow coordination', text: 'Approvals, status changes, late entries, and field confirmations often rely on manual reminders.' },
        { index: '04', title: 'Hard to extend after launch', text: 'Lightweight tools can launch quickly, but fields, workflows, permissions, and cross-module collaboration grow complex.' }
      ]
    },
    solution: {
      kicker: 'EISCore Solution',
      title: 'Bringing business, workflow, data, and AI back into one chain',
      lead: 'EISCore is not a pile of pages. It uses a database-centric core, micro-frontend modules, workflow-to-status mapping, and semantic governance to turn fragile project links into platform capabilities.',
      chain: ['Business forms', 'Workflow approval', 'Inventory ledger', 'Mobile work', 'Semantic context', 'Agent assistance'],
      items: [
        { code: 'DB', title: 'Database-centric architecture', text: 'Core data, permissions, state, functions, and audit context stay in the platform core.' },
        { code: 'MF', title: 'Micro-frontend modularity', text: 'The base portal is the entry point while HR, materials, app center, sales, purchase, and production evolve by domain.' },
        { code: 'WF', title: 'Workflow-state mapping', text: 'BPMN workflow maps back to business status, returning approvals and transitions to business data.' },
        { code: 'SE', title: 'Lightweight semantic governance', text: 'Table, column, and relation semantics explain business objects for configuration, reporting, and agent calls.' },
        { code: 'MO', title: 'Mobile field operations', text: 'Supports scanning, stocktaking, label printing, warehouse queries, and mobile data reporting.' },
        { code: 'AI', title: 'Agent-assisted configuration', text: 'Knowledge QA, tool calling, event streams, and configuration assistance improve system explanation and app building.' }
      ]
    },
    codebase: {
      kicker: 'Real Codebase Capabilities',
      title: 'Not a single-page demo, but a multi-module engineering codebase',
      lead: 'The current repository includes a base portal, HR, materials, app center, mobile app, sales, purchase, production, realtime agent runtime, and database scripts. Core modules are runnable prototypes, while some domains remain in expansion.',
      items: [
        { badge: 'Base', state: 'formed', title: 'Base Portal', text: 'Unified entry, login, settings, micro-frontend shell, enterprise AI entry, and subapp registration.' },
        { badge: 'HR', state: 'formed', title: 'HR / HMS', text: 'Employees, org chart, permissions, user management, attendance, field permissions, and role scopes.' },
        { badge: 'WMS', state: 'formed', title: 'Materials / Inventory', text: 'Materials, batch rules, warehouses, inventory ledger, stock-in/out, checks, labels, and BOM.' },
        { badge: 'Apps', state: 'formed', title: 'App Center', text: 'Data apps, workflow design, approval center, config center, ontology workbench, runtime preview, and published routes.' },
        { badge: 'Mobile', state: 'formed', title: 'Mobile Workbench', text: 'PDA, scanning, warehouse queries, inventory checks, stock scans, labels, attendance, and mobile assistants.' },
        { badge: 'Sales', state: 'expanding', title: 'Sales', text: 'Customers, follow-ups, opportunities, orders, payments, dashboards, and sales cockpit code structure.' },
        { badge: 'Purchase', state: 'expanding', title: 'Purchase', text: 'Suppliers, demands, orders, arrivals, purchase document detail, business status, and dashboard views.' },
        { badge: 'MFG', state: 'expanding', title: 'Production', text: 'BOM, production app entry, production dashboard, plus SQL for BOM explosion, MRP, and work orders.' },
        { badge: 'Agent', state: 'formed', title: 'Realtime / Agent Runtime', text: 'WebSocket, knowledge QA, tool calling, event streams, BPMN integration, and Flash tool channels.' },
        { badge: 'SQL', state: 'formed', title: 'SQL / Database', text: 'app_center, workflow, inventory, twin, BOM, RLS, views, functions, triggers, and initialization scripts.' }
      ]
    },
    scenarios: {
      kicker: 'Manufacturing Scenarios',
      title: 'For multi-batch, small-batch, traceability-heavy field operations',
      lead: 'The story is closer to real manufacturing software: orders, materials, inventory, quality, production, and delivery data become business records that can be queried, explained, and traced.',
      items: [
        { index: 'A', title: 'Multi-batch material management', text: 'Batch rules, stock-in, inventory ledger, and batch status coordination.' },
        { index: 'B', title: 'Shelf life and FIFO', text: 'Inventory use organized around production date, expiry date, and warehouse location.' },
        { index: 'C', title: 'Production issue and replenishment', text: 'Material issue, replenishment, and stock changes become business records.' },
        { index: 'D', title: 'Quality attachments and late entry', text: 'Supports field follow-up, attachments, and later traceability explanation.' },
        { index: 'E', title: 'Sales delivery and logistics', text: 'Sales, outbound stock, delivery, and flow status can continue to expand.' },
        { index: 'F', title: 'Forward and reverse traceability', text: 'From batches to documents, and from documents back to material and inventory origins.' },
        { index: 'G', title: 'Mobile checks and label printing', text: 'PDA, scanning, stocktaking, labels, and warehouse queries for field use.' },
        { index: 'H', title: 'Approval and status write-back', text: 'Workflow actions do not stay isolated; they write back to business status.' }
      ]
    },
    platform: {
      kicker: 'Platform Capability',
      title: 'From business forms to an enterprise app foundation',
      lead: 'The app center is closer to a lightweight internal app-building platform for enterprises, combining forms, tables, workflow, semantics, and controlled agents.',
      windowTitle: 'App Center / Data Apps / Workflow',
      sideTitle: 'Typical build path',
      steps: ['Define tables and fields', 'Configure grids, forms, and permissions', 'Bind workflow and status mapping', 'Publish routes and connect mobile use', 'Use semantics and agents for explanation'],
      items: [
        { title: 'App Center', text: 'Manage data apps, configuration, runtime preview, and publication entry points.' },
        { title: 'Data app configuration', text: 'Build configurable grids, forms, and field displays around business tables.' },
        { title: 'Workflow design', text: 'Support BPMN workflow design and business status mapping.' },
        { title: 'Approval center', text: 'Connect workflow tasks, approval actions, and business status transitions.' },
        { title: 'Semantic relation workbench', text: 'Manage object, field, and relation semantics for explainability.' },
        { title: 'Controlled Agent Runtime', text: 'Assist configuration and QA through tool registration, calls, and event streams.' }
      ]
    },
    architecture: {
      kicker: 'Technical Architecture',
      title: 'Designed for low operational overhead',
      lead: 'The architecture is shaped around lightweight deployment, clear boundaries, and incremental expansion, allowing SME manufacturing projects to grow from core business chains.',
      layers: [
        { title: 'Frontend Shell', text: 'Vue 3 / Vite / qiankun. A unified portal loads multiple business subapps.' },
        { title: 'Data API', text: 'PostgREST / RPC / WebSocket. Data APIs, workflow actions, and real-time events.' },
        { title: 'Database Core', text: 'PostgreSQL 16 / RLS / Schema / Functions / Triggers. Permissions, state, and business constraints.' },
        { title: 'Intelligence Layer', text: 'Semantic Layer / Agent Runtime / Knowledge QA / Tool Calling. Controlled AI assistance.' }
      ],
      tech: ['Vue 3', 'Vite', 'qiankun', 'Element Plus', 'Vant', 'PostgreSQL 16', 'PostgREST', 'RLS', 'BPMN', 'WebSocket', 'Docker Compose', 'Agent Runtime']
    },
    practice: {
      kicker: 'Practice Origin',
      title: 'Experience from real implementation and secondary customization work',
      text: 'EISCore is shaped by common problems distilled from the author’s involvement in SME manufacturing implementation, secondary customization, requirement analysis, and delivery work.',
      disclaimer: 'These statements only explain the source of industry experience and do not imply commercial endorsement, purchase confirmation, or official authorization by any related company or institution.',
      tags: ['Aquatic processing', 'Food manufacturing', 'Canned food', 'Bioproducts', 'Agricultural processing', 'Warehouse logistics', 'Quality traceability', 'Mobile checks', 'Production planning', 'Telecom ecosystem collaboration']
    },
    license: {
      kicker: 'Open Source Boundary',
      title: 'Open code with a clear commercial boundary',
      items: [
        'EISCore code is licensed under AGPL-3.0-or-later.',
        'Documentation may be released under CC BY-NC-SA 4.0.',
        'Open-source publication does not transfer copyright, ownership, exclusive authorization, or rights waiver.',
        'Closed-source commercial delivery, government product declaration, software copyright registration, product ownership declaration, SaaS/private deployment without AGPL compliance requires written authorization from the copyright holder.'
      ]
    },
    footer: {
      documentation: 'Documentation',
      commercial: 'Commercial License',
      evidence: 'Thesis Evidence'
    }
  }
}

const page = computed(() => content[lang.value])

const setLang = (nextLang) => {
  lang.value = nextLang
}

const setupReveal = () => {
  const targets = Array.from(document.querySelectorAll('[data-reveal]'))
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'))
    return
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.08
  })

  targets.forEach((target) => revealObserver.observe(target))
}

onMounted(() => {
  setupReveal()
})

onBeforeUnmount(() => {
  revealObserver?.disconnect()
})
</script>

<style scoped>
:global(html) {
  scroll-behavior: smooth;
}

:global(body:has(.landing-page)) {
  margin: 0;
  background: #070a12;
}

.landing-page {
  min-height: 100vh;
  overflow-x: hidden;
  color: #f7fbff;
  background:
    radial-gradient(circle at 18% 0%, rgba(216, 174, 94, 0.14), transparent 28%),
    radial-gradient(circle at 88% 8%, rgba(103, 92, 255, 0.17), transparent 32%),
    linear-gradient(180deg, #070a12 0%, #09111f 42%, #06080e 100%);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}

.landing-page::before {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  content: "";
  background:
    linear-gradient(rgba(255, 255, 255, 0.032) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.032) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.78), transparent 76%);
}

.site-header,
.section-shell {
  position: relative;
  z-index: 1;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 0;
}

.brand,
.nav-links,
.language-switch {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(10, 15, 26, 0.82);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 188px;
  padding: 10px 14px;
  border-radius: 16px;
  color: #fff;
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  color: #090b10;
  background: linear-gradient(135deg, #f0c96e, #3dd6e8);
  font-weight: 900;
}

.brand-text strong,
.site-footer strong {
  display: block;
  color: #fff;
  font-size: 18px;
  line-height: 1.1;
}

.brand-text small {
  display: block;
  margin-top: 3px;
  color: rgba(236, 242, 255, 0.58);
  font-size: 12px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 999px;
}

.nav-links a {
  padding: 8px 13px;
  border-radius: 999px;
  color: rgba(239, 245, 255, 0.72);
  font-size: 14px;
  text-decoration: none;
  transition: color 160ms ease, background 160ms ease;
}

.nav-links a:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.language-switch {
  display: inline-flex;
  padding: 5px;
  border-radius: 999px;
}

.language-switch button {
  min-width: 52px;
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  color: rgba(239, 245, 255, 0.68);
  background: transparent;
  font-weight: 800;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease;
}

.language-switch button.active {
  color: #080a10;
  background: linear-gradient(135deg, #f0c96e, #3dd6e8);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 0.98fr) minmax(420px, 0.82fr);
  gap: 52px;
  align-items: center;
  min-height: calc(100vh - 84px);
  padding: 52px 0 86px;
}

.eyebrow {
  margin: 0 0 14px;
  color: #f0c96e;
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero h1,
.section-heading h2,
.split-heading h2,
.practice-panel h2,
.license-layout h2 {
  margin: 0;
  color: #fff;
  letter-spacing: 0;
}

.hero h1 {
  max-width: 780px;
  font-size: clamp(42px, 6vw, 76px);
  line-height: 1.02;
  font-weight: 920;
}

.hero h1 span {
  display: block;
  margin-bottom: 10px;
  background: linear-gradient(135deg, #ffffff 0%, #f0c96e 32%, #8b5cf6 68%, #3dd6e8 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  max-width: 720px;
  margin: 24px 0 0;
  color: rgba(236, 242, 255, 0.76);
  font-size: clamp(16px, 1.45vw, 20px);
  line-height: 1.78;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}

.btn {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 999px;
  padding: 0 20px;
  color: #fff;
  background: rgba(255, 255, 255, 0.055);
  font-weight: 850;
  text-decoration: none;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}

.btn:hover {
  border-color: rgba(240, 201, 110, 0.42);
  background: rgba(255, 255, 255, 0.09);
  transform: translateY(-2px);
}

.btn-primary {
  border-color: transparent;
  color: #070a12;
  background: linear-gradient(135deg, #f0c96e, #3dd6e8);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #ffe09a, #65e4f0);
}

.btn-plain {
  color: #f0c96e;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 36px 0 0;
}

.hero-stats div {
  min-height: 78px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 18px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.045);
}

.hero-stats dt {
  color: #f0c96e;
  font-size: 16px;
  font-weight: 900;
}

.hero-stats dd {
  margin: 7px 0 0;
  color: rgba(236, 242, 255, 0.62);
  font-size: 13px;
  line-height: 1.45;
}

.capability-panel,
.info-card,
.feature-card,
.module-card,
.platform-window,
.architecture-frame article,
.practice-panel,
.terminal-panel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(13, 18, 31, 0.88);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
}

.capability-panel {
  border-radius: 28px;
  padding: 18px;
}

.panel-header,
.module-meta,
.window-top,
.terminal-top {
  display: flex;
  align-items: center;
}

.panel-header {
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 16px;
  color: rgba(236, 242, 255, 0.7);
  font-size: 13px;
}

.panel-header strong {
  color: #f0c96e;
  font-size: 12px;
}

.panel-diagram {
  position: relative;
  min-height: 250px;
  overflow: hidden;
  border: 1px solid rgba(240, 201, 110, 0.2);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(240, 201, 110, 0.12), rgba(91, 75, 255, 0.13)),
    rgba(255, 255, 255, 0.035);
}

.panel-diagram svg {
  width: 100%;
  height: 260px;
}

.panel-diagram path {
  fill: none;
  stroke: url("#lineGoldBlue");
  stroke-width: 2.5;
  stroke-linecap: round;
  opacity: 0.82;
}

.panel-diagram circle {
  fill: #f0c96e;
}

.panel-diagram .svg-core {
  fill: rgba(7, 10, 18, 0.92);
  stroke: rgba(240, 201, 110, 0.5);
  stroke-width: 2;
}

.core-node {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 160px;
  transform: translate(-50%, -50%);
  text-align: center;
}

.core-node small {
  display: block;
  color: rgba(236, 242, 255, 0.58);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.core-node strong {
  display: block;
  margin-top: 7px;
  color: #fff;
  font-size: 21px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.panel-grid article {
  display: flex;
  gap: 12px;
  min-height: 96px;
  border: 1px solid rgba(255, 255, 255, 0.085);
  border-radius: 18px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.panel-grid article > span,
.feature-card > span,
.number-label,
.architecture-frame article > span {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  color: #080a10;
  background: linear-gradient(135deg, #f0c96e, #3dd6e8);
  font-weight: 900;
}

.panel-grid strong {
  display: block;
  color: #fff;
}

.panel-grid p {
  margin: 6px 0 0;
  color: rgba(236, 242, 255, 0.62);
  font-size: 13px;
  line-height: 1.55;
}

.section {
  padding: 92px 0;
}

.section-muted {
  position: relative;
  z-index: 1;
  border-block: 1px solid rgba(255, 255, 255, 0.06);
  background:
    linear-gradient(90deg, rgba(240, 201, 110, 0.045), transparent 30%, rgba(99, 102, 241, 0.06)),
    rgba(255, 255, 255, 0.025);
}

.section-heading {
  max-width: 760px;
  margin: 0 auto 38px;
  text-align: center;
}

.section-heading.wide {
  max-width: 910px;
}

.section-heading.align-left {
  margin-left: 0;
  text-align: left;
}

.section-heading h2,
.split-heading h2,
.practice-panel h2,
.license-layout h2 {
  font-size: clamp(30px, 4vw, 50px);
  line-height: 1.14;
}

.section-heading p,
.split-heading > p,
.info-card p,
.feature-card p,
.module-card p,
.scenario-board p,
.platform-main p,
.platform-steps li,
.architecture-frame p,
.practice-panel p,
.license-layout li,
.footer-inner p,
.footer-links {
  color: rgba(236, 242, 255, 0.7);
  line-height: 1.72;
}

.section-heading p,
.split-heading > p {
  margin: 18px 0 0;
  font-size: 16px;
}

.grid {
  display: grid;
  gap: 18px;
}

.grid-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.grid-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.info-card,
.feature-card,
.module-card {
  border-radius: 22px;
  padding: 24px;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}

.info-card:hover,
.feature-card:hover,
.module-card:hover,
.architecture-frame article:hover {
  border-color: rgba(240, 201, 110, 0.32);
  background: rgba(17, 24, 39, 0.92);
  transform: translateY(-3px);
}

.info-card h3,
.feature-card h3,
.module-card h3,
.scenario-board h3,
.platform-main strong,
.architecture-frame h3 {
  margin: 18px 0 10px;
  color: #fff;
  font-size: 20px;
}

.info-card p,
.feature-card p,
.module-card p,
.scenario-board p,
.platform-main p,
.architecture-frame p {
  margin: 0;
}

.split-heading {
  display: grid;
  grid-template-columns: minmax(0, 0.86fr) minmax(320px, 0.74fr);
  gap: 44px;
  align-items: end;
  margin-bottom: 36px;
}

.solution-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 18px;
}

.solution-chain {
  display: grid;
  gap: 10px;
  align-content: start;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  padding: 16px;
  background: rgba(8, 13, 23, 0.72);
}

.solution-chain article {
  display: flex;
  min-height: 54px;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.075);
  border-radius: 16px;
  padding: 12px;
  color: rgba(247, 251, 255, 0.86);
  background: rgba(255, 255, 255, 0.04);
  font-weight: 850;
}

.solution-chain span {
  color: #f0c96e;
  font-size: 12px;
}

.module-board {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.module-card {
  min-height: 230px;
  padding: 20px;
}

.module-meta {
  justify-content: space-between;
  gap: 8px;
}

.module-meta span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  padding: 0 10px;
  color: #0c0d12;
  background: #f0c96e;
  font-size: 12px;
  font-weight: 900;
}

.module-meta small {
  color: #3dd6e8;
  font-weight: 850;
}

.scenario-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(480px, 1fr);
  gap: 48px;
  align-items: start;
}

.scenario-board {
  display: grid;
  gap: 12px;
}

.scenario-board article {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  min-height: 88px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.045);
}

.scenario-board span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 12px;
  color: #f0c96e;
  background: rgba(240, 201, 110, 0.11);
  font-weight: 900;
}

.scenario-board h3 {
  margin-top: 0;
}

.platform-window {
  overflow: hidden;
  border-radius: 28px;
}

.window-top {
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.085);
  padding: 15px 18px;
}

.window-top span,
.terminal-top span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #e96464;
}

.window-top span:nth-child(2),
.terminal-top span:nth-child(2) {
  background: #f0c96e;
}

.window-top span:nth-child(3),
.terminal-top span:nth-child(3) {
  background: #34d399;
}

.window-top strong {
  margin-left: 10px;
  color: rgba(236, 242, 255, 0.76);
  font-size: 13px;
}

.platform-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 18px;
  padding: 18px;
}

.platform-main {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.platform-main article,
.platform-steps {
  border: 1px solid rgba(255, 255, 255, 0.085);
  border-radius: 18px;
  background: rgba(4, 9, 17, 0.42);
}

.platform-main article {
  min-height: 132px;
  padding: 18px;
}

.platform-main strong {
  display: block;
  margin-top: 0;
}

.platform-steps {
  padding: 22px;
}

.platform-steps strong {
  display: block;
  color: #fff;
  font-size: 20px;
}

.platform-steps ol {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
  padding-left: 20px;
}

.architecture-frame {
  display: grid;
  gap: 14px;
  margin-top: 34px;
}

.architecture-frame article {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  border-radius: 22px;
  padding: 24px;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}

.architecture-frame h3 {
  margin-top: 0;
}

.tech-tags,
.tag-cloud,
.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tech-tags {
  margin-top: 24px;
}

.tech-tags span,
.tag-cloud span {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 999px;
  padding: 0 14px;
  color: rgba(247, 251, 255, 0.82);
  background: rgba(255, 255, 255, 0.05);
}

.practice-panel {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(320px, 0.66fr);
  gap: 36px;
  align-items: center;
  border-radius: 28px;
  padding: 34px;
}

.practice-panel h2 {
  margin-bottom: 18px;
}

.practice-panel p {
  margin: 0;
}

.disclaimer {
  margin-top: 18px !important;
  border: 1px solid rgba(240, 201, 110, 0.22);
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(240, 201, 110, 0.06);
}

.license-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.62fr);
  gap: 36px;
  align-items: center;
}

.license-layout ul {
  display: grid;
  gap: 12px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}

.license-layout li {
  position: relative;
  padding-left: 20px;
}

.license-layout li::before {
  position: absolute;
  top: 0.75em;
  left: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #f0c96e;
  content: "";
}

.terminal-panel {
  overflow: hidden;
  border-radius: 22px;
}

.terminal-top {
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.085);
  padding: 14px 16px;
}

.terminal-panel pre {
  margin: 0;
  padding: 22px;
  color: #d9fbff;
  background: rgba(2, 6, 13, 0.7);
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.site-footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(3, 6, 12, 0.74);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 32px 0;
}

.footer-inner p {
  margin: 8px 0 0;
}

.footer-links {
  justify-content: flex-end;
  gap: 10px 18px;
}

.footer-links a {
  color: rgba(236, 242, 255, 0.78);
  text-decoration: none;
}

.footer-links a:hover {
  color: #f0c96e;
}

[data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 360ms ease, transform 360ms ease;
}

[data-reveal].is-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 1180px) {
  .hero,
  .scenario-layout,
  .practice-panel,
  .license-layout {
    grid-template-columns: 1fr;
  }

  .solution-layout,
  .platform-content {
    grid-template-columns: 1fr;
  }

  .module-board,
  .grid-four,
  .grid-three,
  .platform-main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .site-header,
  .section-shell {
    width: min(100% - 28px, 1180px);
  }

  .site-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .nav-links {
    order: 3;
    width: 100%;
    overflow-x: auto;
    justify-content: flex-start;
  }

  .language-switch {
    margin-left: auto;
  }

  .hero {
    min-height: auto;
    padding: 38px 0 66px;
  }

  .hero-actions,
  .hero-stats,
  .panel-grid,
  .module-board,
  .grid-four,
  .grid-three,
  .platform-main,
  .split-heading {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    display: grid;
  }

  .btn {
    width: 100%;
  }

  .section {
    padding: 70px 0;
  }

  .capability-panel,
  .practice-panel,
  .platform-window {
    padding: 0;
  }

  .platform-content {
    padding: 14px;
  }

  .architecture-frame article,
  .scenario-board article {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .brand {
    min-width: auto;
  }

  .brand-text small {
    display: none;
  }

  .hero h1 {
    font-size: 39px;
  }

  .section-heading h2,
  .split-heading h2,
  .practice-panel h2,
  .license-layout h2 {
    font-size: 29px;
  }

  .panel-diagram {
    min-height: 210px;
  }

  .panel-diagram svg {
    height: 220px;
  }

  .terminal-panel pre {
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce), (max-width: 640px) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }

  [data-reveal] {
    opacity: 1;
    transform: none;
  }
}
</style>
