<template>
  <div class="company-site-ops" data-guide="company-site-ops">
    <header class="page-header">
      <div class="page-heading">
        <div class="eyebrow"><span class="eyebrow-dot"></span>企业站点运营</div>
        <h1>把官网内容、线索与发布流程放进 EISCore</h1>
        <p>统一管理独立站的品牌资料、内容资产、搜索优化和销售线索，并沿用系统权限与主题。</p>
      </div>
      <div class="page-actions">
        <el-tag :type="siteStatusType(site?.status)" effect="plain" class="status-pill">
          {{ siteStatusText(site?.status) }}
        </el-tag>
        <el-button :loading="loading" @click="loadAll">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
        <el-button type="primary" plain @click="openCueBuilder">
          <el-icon><Box /></el-icon>
          3D 定制器 / BOM
        </el-button>
        <el-button type="primary" @click="openFactoryDemo">
          <el-icon><DataBoard /></el-icon>
          全厂演示调度台
        </el-button>
        <el-button v-if="canPublish" type="primary" :loading="publishingSite" @click="publishSite">
          <el-icon><Promotion /></el-icon>
          发布站点
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="loadError"
      class="load-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="loadError"
    />

    <el-row :gutter="16" class="summary-grid">
      <el-col v-for="card in summaryCards" :key="card.key" :xs="12" :sm="6">
        <el-card shadow="never" class="summary-card" :class="`summary-${card.tone}`">
          <div class="summary-card-top">
            <span class="summary-label">{{ card.label }}</span>
            <span class="summary-icon"><el-icon><component :is="card.icon" /></el-icon></span>
          </div>
          <div class="summary-value">{{ card.value }}</div>
          <div class="summary-foot">{{ card.foot }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="workspace-card">
      <div class="workspace-tabs-wrap">
        <el-tabs v-model="activeSection" class="workspace-tabs">
          <el-tab-pane name="overview">
            <template #label><span><el-icon><DataBoard /></el-icon>运营总览</span></template>
          </el-tab-pane>
          <el-tab-pane name="content">
            <template #label><span><el-icon><Collection /></el-icon>内容资产</span></template>
          </el-tab-pane>
          <el-tab-pane name="leads">
            <template #label><span><el-icon><User /></el-icon>询盘线索</span></template>
          </el-tab-pane>
          <el-tab-pane name="drafts">
            <template #label><span><el-icon><Document /></el-icon>销售草稿</span></template>
          </el-tab-pane>
          <el-tab-pane name="seo">
            <template #label><span><el-icon><TrendCharts /></el-icon>SEO / GEO</span></template>
          </el-tab-pane>
          <el-tab-pane name="facts">
            <template #label><span><el-icon><DocumentChecked /></el-icon>事实治理</span></template>
          </el-tab-pane>
          <el-tab-pane name="settings">
            <template #label><span><el-icon><Setting /></el-icon>站点设置</span></template>
          </el-tab-pane>
        </el-tabs>
      </div>

      <section v-if="activeSection === 'overview'" class="overview-section">
        <div class="overview-banner">
          <div class="banner-mark"><el-icon><Promotion /></el-icon></div>
          <div class="banner-copy">
            <div class="banner-title">{{ site?.brandName || site?.legalName || '企业站点' }}</div>
            <div class="banner-subtitle">
              {{ site?.domain || '尚未配置站点域名' }} · 默认语言 {{ site?.defaultLocale || 'zh-CN' }} · 模板 {{ site?.template || 'manufacturer-editorial-v1' }}
            </div>
          </div>
          <div class="banner-meta">
            <span>已发布版本</span>
            <strong>v{{ site?.publishedVersion || 0 }}</strong>
          </div>
        </div>

        <div class="overview-grid">
          <div class="overview-panel">
            <div class="panel-heading">
              <div><h2>运营链路</h2><p>从内容准备到站点发布的当前状态</p></div>
              <el-tag type="success" effect="light">EISCore 内部模块</el-tag>
            </div>
            <div class="flow-line">
              <div v-for="step in operationSteps" :key="step.key" class="flow-step" :class="`is-${step.state}`">
                <span class="flow-step-icon"><el-icon><component :is="step.icon" /></el-icon></span>
                <span class="flow-step-name">{{ step.name }}</span>
                <span class="flow-step-state">{{ step.stateText }}</span>
              </div>
            </div>
          </div>

          <div class="overview-panel attention-panel">
            <div class="panel-heading">
              <div><h2>今日关注</h2><p>优先处理影响公开站点的事项</p></div>
              <el-icon class="panel-heading-icon"><Warning /></el-icon>
            </div>
            <div v-if="attentionItems.length" class="attention-list">
              <div v-for="item in attentionItems" :key="item.key" class="attention-item">
                <span class="attention-dot" :class="`dot-${item.tone}`"></span>
                <span class="attention-text">{{ item.text }}</span>
                <el-button link type="primary" @click="activeSection = item.section">处理</el-button>
              </div>
            </div>
            <el-empty v-else description="暂无需要立即处理的事项" :image-size="58" />
          </div>
        </div>

        <div class="recent-panel">
          <div class="panel-heading">
            <div><h2>最近更新</h2><p>内容资产的最近编辑记录</p></div>
            <el-button link type="primary" @click="activeSection = 'content'">查看全部</el-button>
          </div>
          <el-table v-if="recentContentRows.length" :data="recentContentRows" size="small" class="ops-table" table-layout="fixed">
            <el-table-column prop="title" label="内容" min-width="220" show-overflow-tooltip />
            <el-table-column prop="typeText" label="类型" width="110" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><el-tag size="small" :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="180">
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无内容资产" :image-size="70" />
        </div>
      </section>

      <section v-else-if="activeSection === 'content'" class="content-section">
        <div class="section-toolbar">
          <div>
            <h2>内容资产</h2>
            <p>页面、产品、行业方案、案例、证书、资料、证据和知识库统一维护，保存后进入草稿状态。</p>
          </div>
          <div class="toolbar-actions">
            <el-select v-model="activeContentType" class="content-type-select" @change="loadContent(activeContentType)">
              <el-option v-for="type in contentTypes" :key="type.key" :label="type.label" :value="type.key" />
            </el-select>
            <el-button v-if="canContentWrite" type="primary" @click="newContent(activeContentType)">
              <el-icon><Plus /></el-icon>新建{{ activeContentTypeLabel }}
            </el-button>
          </div>
        </div>

        <el-table v-loading="contentLoading" :data="activeContentRows" class="ops-table content-table" table-layout="fixed">
          <el-table-column label="名称 / 标识" min-width="230" show-overflow-tooltip>
            <template #default="{ row }">{{ contentTitle(row, activeContentType) }}</template>
          </el-table-column>
          <el-table-column label="语言 / 路径" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ contentMeta(row, activeContentType) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><el-tag size="small" :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="{ row }">{{ formatDate(row.updatedAt || row.updated_at) }}</template>
          </el-table-column>
          <el-table-column v-if="canContentWrite || canPublish" label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="editContent(activeContentType, row)">编辑</el-button>
              <el-button v-if="nextStatus(row, activeContentType)" link type="primary" @click="advanceContentStatus(activeContentType, row)">
                {{ nextStatusLabel(row, activeContentType) }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!contentLoading && !activeContentRows.length" description="当前内容类型暂无记录" :image-size="90" />
      </section>

      <section v-else-if="activeSection === 'leads'" class="leads-section">
        <div class="section-toolbar">
          <div>
            <h2>询盘线索</h2>
            <p>承接独立站公开表单和 Agent 会话产生的线索，后续可继续进入销售模块处理。</p>
          </div>
          <el-button @click="loadLeads" :loading="leadsLoading"><el-icon><Refresh /></el-icon>刷新线索</el-button>
        </div>
        <el-table v-loading="leadsLoading" :data="leads" class="ops-table leads-table" table-layout="fixed">
          <el-table-column label="线索编号" width="175" show-overflow-tooltip><template #default="{ row }">{{ row.publicRef || row.public_ref || '-' }}</template></el-table-column>
          <el-table-column label="企业 / 联系人" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ row.companyName || row.company_name || '-' }} / {{ row.contactName || row.contact_name || '-' }}</template>
          </el-table-column>
          <el-table-column label="联系方式" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.email || row.phone || row.whatsapp || '-' }}</template>
          </el-table-column>
          <el-table-column prop="country" label="国家/地区" width="110" show-overflow-tooltip />
          <el-table-column label="来源" width="110"><template #default="{ row }">{{ row.source || 'website' }}</template></el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag size="small" :type="leadStatusType(row.status)" effect="light">{{ leadStatusText(row.status) }}</el-tag></template></el-table-column>
          <el-table-column label="提交时间" width="170"><template #default="{ row }">{{ formatDate(row.createdAt || row.created_at) }}</template></el-table-column>
          <el-table-column v-if="canSalesWrite" label="处理" width="130" fixed="right">
            <template #default="{ row }"><el-button link type="primary" @click="runCustomerMatch(row)">匹配建议</el-button></template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!leadsLoading && !leads.length" description="暂无站点询盘线索" :image-size="90" />
      </section>

      <section v-else-if="activeSection === 'drafts'" class="drafts-section">
        <div class="section-toolbar">
          <div>
            <h2>销售草稿</h2>
            <p>商机、报价、订单和生产建议只在本站保留为草稿；每一步都要先完成人工批准，才允许进入下一步。</p>
          </div>
          <div class="toolbar-actions">
            <el-select v-model="draftFilter" size="small" class="draft-filter" @change="loadDrafts">
              <el-option label="全部草稿" value="" />
              <el-option label="商机" value="opportunity" />
              <el-option label="报价" value="quote" />
              <el-option label="销售订单" value="order" />
              <el-option label="生产建议" value="production" />
            </el-select>
            <el-button :loading="draftsLoading" @click="loadDrafts"><el-icon><Refresh /></el-icon>刷新草稿</el-button>
          </div>
        </div>
        <el-alert class="draft-boundary-alert" type="warning" :closable="false" show-icon title="人工确认边界：这里的记录不会直接创建正式客户、订单、库存或生产任务。" />
        <el-table v-loading="draftsLoading" :data="drafts" class="ops-table drafts-table" table-layout="fixed">
          <el-table-column label="类型 / 草稿编号" min-width="210" show-overflow-tooltip>
            <template #default="{ row }"><strong>{{ draftTypeText(row.draftType) }}</strong><span class="table-secondary">{{ row.id }}</span></template>
          </el-table-column>
          <el-table-column label="关联线索" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ draftLeadRef(row) }}</template></el-table-column>
          <el-table-column label="审批状态" width="120"><template #default="{ row }"><el-tag size="small" :type="draftApprovalType(row.approvalStatus)" effect="light">{{ draftApprovalText(row.approvalStatus) }}</el-tag></template></el-table-column>
          <el-table-column label="来源 trace" min-width="190" show-overflow-tooltip><template #default="{ row }">{{ row.source?.traceId || row.source?.trace_id || '-' }}</template></el-table-column>
          <el-table-column label="创建时间" width="170"><template #default="{ row }">{{ formatDate(row.createdAt || row.created_at) }}</template></el-table-column>
          <el-table-column v-if="canSalesApprove || canSalesPrecheck" label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canSalesApprove && row.approvalStatus !== 'approved'" link type="success" @click="approveDraft(row)">人工批准</el-button>
              <el-button v-if="canSalesPrecheck && row.draftType === 'order'" link type="primary" @click="precheckDraft(row)">只读预检</el-button>
              <el-button link type="primary" @click="openDraft(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!draftsLoading && !drafts.length" description="当前没有销售草稿" :image-size="90" />
      </section>

      <section v-else-if="activeSection === 'seo'" class="seo-section">
        <div class="section-toolbar">
          <div>
            <h2>SEO / GEO 质量检查</h2>
            <p>检查页面元数据、canonical、robots 和公开内容的可发现性，结果会保留在审计链路中。</p>
          </div>
          <el-button v-if="canAudit" type="primary" :loading="seoLoading" @click="runSeoCheck"><el-icon><TrendCharts /></el-icon>运行检查</el-button>
        </div>
        <div class="seo-overview">
          <div class="seo-score-card">
            <span class="seo-score-label">最近一次检查</span>
            <strong>{{ seoSummary.label }}</strong>
            <span>{{ seoSummary.detail }}</span>
          </div>
          <div class="seo-stat"><span>问题总数</span><strong>{{ seoSummary.total }}</strong></div>
          <div class="seo-stat"><span>严重 / 错误</span><strong class="is-danger">{{ seoSummary.critical }}</strong></div>
          <div class="seo-stat"><span>已解决</span><strong class="is-success">{{ seoSummary.resolved }}</strong></div>
        </div>
        <el-table v-loading="seoLoading" :data="seoChecks" class="ops-table" table-layout="fixed">
          <el-table-column prop="path" label="路径" min-width="190" show-overflow-tooltip />
          <el-table-column label="检查项" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.checkType || row.check_type || '-' }}</template></el-table-column>
          <el-table-column label="级别" width="110"><template #default="{ row }"><el-tag size="small" :type="severityTagType(row.severity)" effect="light">{{ severityText(row.severity) }}</el-tag></template></el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag size="small" :type="row.status === 'resolved' ? 'success' : 'danger'" effect="light">{{ row.status === 'resolved' ? '已解决' : '待处理' }}</el-tag></template></el-table-column>
          <el-table-column label="详情" min-width="280" show-overflow-tooltip><template #default="{ row }">{{ detailText(row.details) }}</template></el-table-column>
          <el-table-column label="检查时间" width="170"><template #default="{ row }">{{ formatDate(row.checkedAt || row.checked_at) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!seoLoading && !seoChecks.length" description="暂未运行 SEO 检查" :image-size="90" />

        <div class="keyword-map-panel">
          <div class="panel-heading">
            <div><h2>关键词地图</h2><p>已发布关键词按语言、市场和目标路径检查；缺口只生成运营任务，不会自动发布内容。</p></div>
            <el-button v-if="canAudit" link type="primary" :loading="keywordMapLoading" @click="loadKeywordMap">刷新地图</el-button>
          </div>
          <div class="keyword-map-summary">
            <div><span>已发布关键词</span><strong>{{ keywordMapReport?.summary?.keywords || 0 }}</strong></div>
            <div><span>覆盖路径</span><strong>{{ keywordMapReport?.summary?.mappedPaths || 0 }}/{{ keywordMapReport?.summary?.expectedPaths || 0 }}</strong></div>
            <div><span>主词数量</span><strong>{{ keywordMapReport?.summary?.primary || 0 }}</strong></div>
            <div><span>缺口</span><strong :class="{ 'is-danger': keywordMapReport?.summary?.gaps }">{{ keywordMapReport?.summary?.gaps || 0 }}</strong></div>
          </div>
          <el-table v-loading="keywordMapLoading" :data="keywordMapReport?.items || []" class="ops-table keyword-table" table-layout="fixed">
            <el-table-column prop="keyword" label="关键词" min-width="220" show-overflow-tooltip />
            <el-table-column label="类型 / 意图" width="150"><template #default="{ row }">{{ keywordTypeText(row.keywordType) }} · {{ keywordIntentText(row.intent) }}</template></el-table-column>
            <el-table-column prop="market" label="市场" width="100" show-overflow-tooltip />
            <el-table-column prop="customerRole" label="客户角色" width="130" show-overflow-tooltip />
            <el-table-column prop="targetPath" label="目标路径" min-width="210" show-overflow-tooltip />
            <el-table-column prop="ownerId" label="负责人" width="120" show-overflow-tooltip />
          </el-table>
          <el-empty v-if="!keywordMapLoading && !(keywordMapReport?.items || []).length" description="还没有已发布关键词" :image-size="70" />
          <div v-if="(keywordMapReport?.gaps || []).length" class="keyword-gap-list">
            <span v-for="gap in keywordMapReport.gaps" :key="`${gap.path}-${gap.issueCode}`" class="keyword-gap">{{ gap.issueCode }} · {{ gap.path }}</span>
          </div>
        </div>
      </section>

      <section v-else-if="activeSection === 'facts'" class="facts-section">
        <div class="section-toolbar">
          <div>
            <h2>事实治理</h2>
            <p>把公开声明、GEO 回答和纠偏任务放在同一条证据链上；未核验事实不会进入 Agent 知识。</p>
          </div>
          <div class="toolbar-actions">
            <el-button :loading="factLoading" @click="scanFacts"><el-icon><DocumentChecked /></el-icon>扫描事实</el-button>
            <el-button v-if="canAudit" type="primary" plain :loading="geoLoading" @click="generateGeoSnapshots"><el-icon><DataAnalysis /></el-icon>生成 GEO 快照</el-button>
          </div>
        </div>

        <div class="governance-summary">
          <div class="governance-score">
            <span class="governance-label">最近扫描</span>
            <strong>{{ factSummary.label }}</strong>
            <small>{{ factSummary.detail }}</small>
          </div>
          <div class="governance-stat"><span>开放任务</span><strong>{{ factSummary.openTasks }}</strong></div>
          <div class="governance-stat"><span>过期事实</span><strong class="is-warning">{{ factSummary.expired }}</strong></div>
          <div class="governance-stat"><span>冲突事实</span><strong class="is-danger">{{ factSummary.conflicts }}</strong></div>
        </div>

        <div class="governance-panel">
          <div class="panel-heading">
            <div><h2>纠偏任务</h2><p>先处理冲突、过期或 GEO 错误答案，再重新发布相关内容。</p></div>
            <div class="toolbar-actions">
              <el-select v-model="correctionFilter" size="small" class="correction-filter" @change="loadCorrectionTasks">
                <el-option label="开放任务" value="open" />
                <el-option label="处理中" value="in_progress" />
                <el-option label="全部任务" value="" />
              </el-select>
              <el-icon class="panel-heading-icon"><WarningFilled /></el-icon>
            </div>
          </div>
          <el-table v-loading="correctionsLoading" :data="correctionTasks" class="ops-table facts-desktop-table" table-layout="fixed">
            <el-table-column label="对象 / 问题" min-width="230" show-overflow-tooltip>
              <template #default="{ row }"><strong>{{ row.objectType }}</strong><span class="table-secondary">{{ row.issueCode }}</span></template>
            </el-table-column>
            <el-table-column label="级别" width="100"><template #default="{ row }"><el-tag size="small" :type="severityTagType(row.severity)" effect="light">{{ severityText(row.severity) }}</el-tag></template></el-table-column>
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag size="small" :type="correctionStatusType(row.status)" effect="light">{{ correctionStatusText(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="详情" min-width="280" show-overflow-tooltip><template #default="{ row }">{{ detailText(row.details) }}</template></el-table-column>
            <el-table-column label="更新" width="170"><template #default="{ row }">{{ formatDate(row.updatedAt || row.updated_at) }}</template></el-table-column>
            <el-table-column v-if="canContentWrite" label="处理" width="190" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'open'" link type="primary" @click="updateCorrectionStatus(row, 'in_progress')">开始处理</el-button>
                <el-button v-if="['open', 'in_progress'].includes(row.status)" link type="success" @click="updateCorrectionStatus(row, 'resolved')">标记解决</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-loading="correctionsLoading" class="facts-mobile-list">
            <article v-for="row in correctionTasks" :key="row.id" class="facts-mobile-item">
              <div class="facts-mobile-item-head"><strong>{{ row.objectType }}</strong><el-tag size="small" :type="correctionStatusType(row.status)" effect="light">{{ correctionStatusText(row.status) }}</el-tag></div>
              <div class="facts-mobile-code">{{ row.issueCode }} · {{ severityText(row.severity) }}</div>
              <p>{{ detailText(row.details) }}</p>
              <div class="facts-mobile-meta">更新于 {{ formatDate(row.updatedAt || row.updated_at) }}</div>
              <div v-if="canContentWrite && ['open', 'in_progress'].includes(row.status)" class="facts-mobile-actions">
                <el-button v-if="row.status === 'open'" link type="primary" @click="updateCorrectionStatus(row, 'in_progress')">开始处理</el-button>
                <el-button link type="success" @click="updateCorrectionStatus(row, 'resolved')">标记解决</el-button>
              </div>
            </article>
          </div>
          <el-empty v-if="!correctionsLoading && !correctionTasks.length" description="当前筛选下没有纠偏任务" :image-size="72" />
        </div>

        <div class="governance-panel geo-panel">
          <div class="panel-heading">
            <div><h2>GEO 回答快照</h2><p>固定问题集的回答、引用和人工准确性状态。</p></div>
            <span class="panel-count"><el-icon><Tickets /></el-icon>{{ geoSnapshots.length }} 条</span>
          </div>
          <el-table v-loading="geoLoading" :data="geoSnapshots" class="ops-table facts-desktop-table" table-layout="fixed">
            <el-table-column label="问题" min-width="250" show-overflow-tooltip><template #default="{ row }">{{ row.question }}</template></el-table-column>
            <el-table-column label="平台 / 语言" width="155"><template #default="{ row }">{{ row.platform }} · {{ row.locale }}</template></el-table-column>
            <el-table-column label="准确性" width="110"><template #default="{ row }"><el-tag size="small" :type="accuracyStatusType(row.accuracyStatus)" effect="light">{{ accuracyStatusText(row.accuracyStatus) }}</el-tag></template></el-table-column>
            <el-table-column label="引用" width="80"><template #default="{ row }">{{ (row.citations || []).length }}</template></el-table-column>
            <el-table-column label="回答" min-width="320" show-overflow-tooltip><template #default="{ row }">{{ row.answer }}</template></el-table-column>
            <el-table-column label="采集时间" width="170"><template #default="{ row }">{{ formatDate(row.capturedAt || row.captured_at) }}</template></el-table-column>
            <el-table-column v-if="canPublish" label="复核" width="210" fixed="right">
              <template #default="{ row }">
                <el-button link type="success" @click="reviewGeoSnapshot(row, 'verified')">准确</el-button>
                <el-button link type="warning" @click="reviewGeoSnapshot(row, 'needs_review')">待复核</el-button>
                <el-button link type="danger" @click="reviewGeoSnapshot(row, 'incorrect')">错误</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-loading="geoLoading" class="facts-mobile-list">
            <article v-for="row in geoSnapshots" :key="row.id" class="facts-mobile-item geo-mobile-item">
              <div class="facts-mobile-item-head"><strong>{{ row.platform }} · {{ row.locale }}</strong><el-tag size="small" :type="accuracyStatusType(row.accuracyStatus)" effect="light">{{ accuracyStatusText(row.accuracyStatus) }}</el-tag></div>
              <div class="facts-mobile-code">{{ row.question }}</div>
              <p>{{ row.answer }}</p>
              <div class="facts-mobile-meta">{{ (row.citations || []).length }} 条引用 · {{ formatDate(row.capturedAt || row.captured_at) }}</div>
              <div v-if="canPublish" class="facts-mobile-actions">
                <el-button link type="success" @click="reviewGeoSnapshot(row, 'verified')">准确</el-button>
                <el-button link type="warning" @click="reviewGeoSnapshot(row, 'needs_review')">待复核</el-button>
                <el-button link type="danger" @click="reviewGeoSnapshot(row, 'incorrect')">错误</el-button>
              </div>
            </article>
          </div>
          <el-empty v-if="!geoLoading && !geoSnapshots.length" description="还没有 GEO 快照，先生成一组基线问题" :image-size="72" />
        </div>
      </section>

      <section v-else class="settings-section">
        <div class="section-toolbar">
          <div>
            <h2>站点设置</h2>
            <p>配置企业品牌、域名、默认语言和主题扩展数据；保存后需要重新发布才会进入公开站点。</p>
          </div>
          <div class="toolbar-actions">
            <el-tag type="info" effect="plain">主题跟随系统</el-tag>
            <el-button v-if="canSiteWrite" type="primary" :loading="savingSite" @click="saveSite">保存设置</el-button>
          </div>
        </div>
        <el-form :model="siteForm" label-position="top" class="site-form">
          <div class="form-grid form-grid-three">
            <el-form-item label="企业法定名称"><el-input v-model="siteForm.legalName" placeholder="例如：君乐缘食品有限公司" /></el-form-item>
            <el-form-item label="品牌名称"><el-input v-model="siteForm.brandName" placeholder="公开站点显示名称" /></el-form-item>
            <el-form-item label="品牌简称"><el-input v-model="siteForm.brandShortName" placeholder="导航栏短名称" /></el-form-item>
            <el-form-item label="工厂名称"><el-input v-model="siteForm.factoryName" placeholder="工厂或生产基地名称" /></el-form-item>
            <el-form-item label="站点域名"><el-input v-model="siteForm.domain" placeholder="例如：www.example.com" /></el-form-item>
            <el-form-item label="默认语言"><el-input v-model="siteForm.defaultLocale" placeholder="zh-CN" /></el-form-item>
          </div>
          <div class="form-grid form-grid-two">
            <el-form-item label="启用语言 JSON"><el-input v-model="siteForm.enabledLocalesText" type="textarea" :rows="4" placeholder='["zh-CN", "en-US"]' /></el-form-item>
            <el-form-item label="品牌主题扩展 JSON"><el-input v-model="siteForm.themeText" type="textarea" :rows="4" placeholder='{"accent":"#409eff"}' /></el-form-item>
            <el-form-item label="联系方式 JSON"><el-input v-model="siteForm.contactText" type="textarea" :rows="5" placeholder='{"email":"sales@example.com"}' /></el-form-item>
            <el-form-item label="站点 SEO JSON"><el-input v-model="siteForm.seoText" type="textarea" :rows="5" placeholder='{"title":"企业官网"}' /></el-form-item>
          </div>
        </el-form>
      </section>
    </el-card>

    <el-dialog v-model="editDialogVisible" :title="editingId ? `编辑${activeContentTypeLabel}` : `新建${activeContentTypeLabel}`" width="min(760px, calc(100vw - 28px))" class="ops-dialog" destroy-on-close>
      <el-form :model="editingForm" label-position="top" class="content-form">
        <div class="form-grid form-grid-two">
          <el-form-item v-if="hasLocaleField" label="语言" required><el-input v-model="editingForm.locale" placeholder="zh-CN" /></el-form-item>
          <el-form-item v-if="hasSlugField" label="Slug / 路径" required><el-input v-model="editingForm.slugOrPath" placeholder="about-us 或 /company/" /></el-form-item>
          <el-form-item v-if="editingType === 'product'" label="产品编号" required><el-input v-model="editingForm.productCode" placeholder="产品唯一编号" /></el-form-item>
          <el-form-item v-if="editingType === 'product'" label="产品分类"><el-input v-model="editingForm.category" placeholder="按产品线或应用分类" /></el-form-item>
          <el-form-item v-if="editingType === 'page'" label="页面类型"><el-input v-model="editingForm.pageType" placeholder="page / landing / home" /></el-form-item>
          <el-form-item v-if="editingType === 'knowledge'" label="文档类型"><el-input v-model="editingForm.documentType" placeholder="faq / policy / product" /></el-form-item>
          <el-form-item v-if="editingType === 'case'" label="公开级别"><el-select v-model="editingForm.publicLevel" style="width:100%"><el-option label="公开" value="named" /><el-option label="匿名公开" value="anonymous" /><el-option label="内部" value="internal" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'certificate'" label="公开级别"><el-select v-model="editingForm.publicLevel" style="width:100%"><el-option label="公开" value="public" /><el-option label="内部" value="internal" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'download'" label="访问策略"><el-select v-model="editingForm.accessPolicy" style="width:100%"><el-option label="公开访问" value="public" /><el-option label="提交询盘后获取" value="lead_required" /><el-option label="内部资料" value="internal" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'solution' || editingType === 'case'" label="行业"><el-input v-model="editingForm.industry" placeholder="食品、制造、零售等" /></el-form-item>
          <el-form-item v-if="editingType === 'certificate'" label="签发方"><el-input v-model="editingForm.issuer" placeholder="证书或检测报告签发方" /></el-form-item>
          <el-form-item v-if="editingType === 'certificate'" label="编号"><el-input v-model="editingForm.certificateNumber" placeholder="企业确认后填写" /></el-form-item>
          <el-form-item v-if="editingType === 'evidence'" label="来源类型"><el-input v-model="editingForm.sourceType" placeholder="internal_document / certificate" /></el-form-item>
          <el-form-item v-if="editingType === 'evidence'" label="来源引用"><el-input v-model="editingForm.sourceRef" placeholder="文件编号、证书编号或内部链接" /></el-form-item>
          <el-form-item v-if="editingType === 'keyword'" label="关键词类型"><el-select v-model="editingForm.keywordType" style="width:100%"><el-option label="主词" value="primary" /><el-option label="辅助词" value="secondary" /><el-option label="支持词" value="supporting" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'keyword'" label="搜索意图"><el-select v-model="editingForm.intent" style="width:100%"><el-option label="信息型" value="informational" /><el-option label="商业型" value="commercial" /><el-option label="交易型" value="transactional" /><el-option label="导航型" value="navigational" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'keyword'" label="目标市场"><el-input v-model="editingForm.market" placeholder="US / UK / CN" /></el-form-item>
          <el-form-item v-if="editingType === 'keyword'" label="客户角色"><el-input v-model="editingForm.customerRole" placeholder="玩家、球房、经销商、OEM" /></el-form-item>
          <el-form-item v-if="editingType === 'keyword'" label="目标路径"><el-input v-model="editingForm.targetPath" placeholder="/products/billiard-cues" /></el-form-item>
          <el-form-item v-if="editingType === 'keyword'" label="优先级"><el-input-number v-model="editingForm.priority" :min="1" :max="5" controls-position="right" style="width:100%" /></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="档案类型"><el-select v-model="editingForm.profileType" style="width:100%"><el-option label="行业目录" value="directory" /><el-option label="协会" value="association" /><el-option label="合作伙伴" value="partner" /><el-option label="媒体" value="media" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="核验状态"><el-select v-model="editingForm.verificationStatus" style="width:100%"><el-option label="待核验" value="pending" /><el-option label="已核验" value="verified" /><el-option label="需复核" value="needs_review" /><el-option label="阻断" value="blocked" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="市场 / 语言"><el-input v-model="editingForm.market" placeholder="US · en-US" /></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="负责人"><el-input v-model="editingForm.ownerId" placeholder="负责人账号" /></el-form-item>
        </div>

        <el-form-item v-if="hasTitleField" label="标题" required><el-input v-model="editingForm.title" placeholder="公开展示标题" /></el-form-item>
        <el-form-item v-if="editingType === 'evidence'" label="可验证声明" required><el-input v-model="editingForm.claim" type="textarea" :rows="3" placeholder="只能填写可被证据支持的事实" /></el-form-item>
        <el-form-item v-if="editingType === 'solution'" label="应用场景"><el-input v-model="editingForm.scenario" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'case'" label="项目范围"><el-input v-model="editingForm.scope" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'certificate' || editingType === 'download'" label="公开说明"><el-input v-model="editingForm.description" type="textarea" :rows="3" placeholder="说明公开范围和资料用途，不填写未经确认的商业承诺" /></el-form-item>
        <el-form-item v-if="editingType === 'page' || editingType === 'solution' || editingType === 'case'" label="摘要 / 说明"><el-input v-model="editingForm.summary" type="textarea" :rows="3" /></el-form-item>
        <div v-if="editingType === 'certificate'" class="form-grid form-grid-two">
          <el-form-item label="生效日期"><el-input v-model="editingForm.validFrom" placeholder="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="有效期至"><el-input v-model="editingForm.validTo" placeholder="YYYY-MM-DD" /></el-form-item>
        </div>
        <div v-if="editingType === 'download'" class="form-grid form-grid-two">
          <el-form-item label="文件名"><el-input v-model="editingForm.fileName" placeholder="catalog.pdf" /></el-form-item>
          <el-form-item label="MIME 类型"><el-input v-model="editingForm.mimeType" placeholder="application/pdf" /></el-form-item>
          <el-form-item label="公开文件地址"><el-input v-model="editingForm.assetUrl" placeholder="仅公开资料填写；内部地址不会返回给访客" /></el-form-item>
          <el-form-item label="有效期至"><el-input v-model="editingForm.expiresAt" placeholder="可选，YYYY-MM-DD" /></el-form-item>
        </div>
        <el-form-item v-if="editingType === 'knowledge'" label="问题" required><el-input v-model="editingForm.question" type="textarea" :rows="2" placeholder="客户会问什么？" /></el-form-item>
        <el-form-item v-if="editingType === 'knowledge'" label="回答内容" required><el-input v-model="editingForm.answer" type="textarea" :rows="8" placeholder="只能填写已核验、可引用的公开回答" /></el-form-item>
        <el-form-item v-if="editingType === 'keyword'" label="关键词" required><el-input v-model="editingForm.keyword" placeholder="例如：custom billiard cue manufacturer" /></el-form-item>
        <el-form-item v-if="editingType === 'keyword'" label="来源"><el-input v-model="editingForm.source" placeholder="research / Search Console / sales feedback" /></el-form-item>
        <el-form-item v-if="editingType === 'externalProfile'" label="名称" required><el-input v-model="editingForm.profileName" placeholder="第三方页面显示名称" /></el-form-item>
        <el-form-item v-if="editingType === 'externalProfile'" label="标准名称" required><el-input v-model="editingForm.canonicalName" placeholder="用于跨渠道一致性比对" /></el-form-item>
  <el-form-item v-if="editingType === 'externalProfile'" label="公开 URL" required><el-input v-model="editingForm.url" placeholder="https://..." /></el-form-item>
        <div v-if="editingType === 'externalProfile'" class="form-grid form-grid-two">
          <el-form-item label="最后核验时间"><el-input v-model="editingForm.lastCheckedAt" placeholder="2026-08-14T00:00:00Z" /></el-form-item>
          <el-form-item label="有效期至"><el-input v-model="editingForm.expiresAt" placeholder="可选，YYYY-MM-DD" /></el-form-item>
          <el-form-item label="证据 ID JSON"><el-input v-model="editingForm.evidenceIdsText" type="textarea" :rows="3" placeholder='["evidence-001"]' /></el-form-item>
        </div>
        <el-form-item v-if="editingType === 'externalProfile'" label="备注"><el-input v-model="editingForm.notes" type="textarea" :rows="3" placeholder="渠道、核验方式或授权说明" /></el-form-item>

        <div v-if="editingType === 'product'" class="form-grid form-grid-two">
          <el-form-item label="应用范围 JSON"><el-input v-model="editingForm.applicationsText" type="textarea" :rows="4" placeholder='["烘焙", "餐饮"]' /></el-form-item>
          <el-form-item label="规格 JSON"><el-input v-model="editingForm.specificationsText" type="textarea" :rows="4" placeholder='{"capacity":""}' /></el-form-item>
          <el-form-item label="交付 JSON"><el-input v-model="editingForm.deliveryText" type="textarea" :rows="4" placeholder='{"leadTime":""}' /></el-form-item>
          <el-form-item label="证据 ID JSON"><el-input v-model="editingForm.evidenceIdsText" type="textarea" :rows="4" placeholder='[]' /></el-form-item>
        </div>
        <div v-if="editingType === 'page'" class="form-grid form-grid-two">
          <el-form-item label="页面区块 JSON"><el-input v-model="editingForm.blocksText" type="textarea" :rows="6" placeholder='[{"type":"hero","title":""}]' /></el-form-item>
          <el-form-item label="页面 SEO JSON"><el-input v-model="editingForm.seoText" type="textarea" :rows="6" placeholder='{"title":"","description":""}' /></el-form-item>
        </div>
        <div v-if="editingType === 'solution' || editingType === 'case'" class="form-grid form-grid-two">
          <el-form-item label="内容 JSON"><el-input v-model="editingForm.contentText" type="textarea" :rows="6" placeholder='{"challenge":"","result":""}' /></el-form-item>
          <el-form-item label="SEO JSON"><el-input v-model="editingForm.seoText" type="textarea" :rows="6" placeholder='{"title":"","description":""}' /></el-form-item>
        </div>
        <div v-if="editingType === 'certificate'" class="form-grid form-grid-two">
          <el-form-item label="证据 JSON"><el-input v-model="editingForm.evidenceText" type="textarea" :rows="5" placeholder='{"document":"","page":""}' /></el-form-item>
        </div>
        <div v-if="editingType === 'evidence' || editingType === 'knowledge'" class="form-grid form-grid-two">
          <el-form-item v-if="editingType === 'evidence'" label="证据 JSON"><el-input v-model="editingForm.evidenceText" type="textarea" :rows="5" placeholder='{"document":"","page":""}' /></el-form-item>
          <el-form-item v-if="editingType === 'evidence'" label="有效期"><el-input v-model="editingForm.expiresAt" placeholder="2027-12-31" /></el-form-item>
          <el-form-item v-if="editingType === 'knowledge'" label="引用 JSON"><el-input v-model="editingForm.citationsText" type="textarea" :rows="5" placeholder='[]' /></el-form-item>
          <el-form-item v-if="editingType === 'knowledge'" label="禁用声明 JSON"><el-input v-model="editingForm.forbiddenClaimsText" type="textarea" :rows="5" placeholder='[]' /></el-form-item>
        </div>
        <div v-if="editingType === 'seo'" class="form-grid form-grid-two">
          <el-form-item label="页面标题" required><el-input v-model="editingForm.title" /></el-form-item>
          <el-form-item label="Robots"><el-input v-model="editingForm.robots" placeholder="index,follow" /></el-form-item>
          <el-form-item label="描述"><el-input v-model="editingForm.description" type="textarea" :rows="4" /></el-form-item>
          <el-form-item label="Canonical"><el-input v-model="editingForm.canonical" placeholder="https://example.com/company/" /></el-form-item>
          <el-form-item label="关键词 JSON"><el-input v-model="editingForm.keywordsText" type="textarea" :rows="4" placeholder='["食品工厂"]' /></el-form-item>
          <el-form-item label="结构化数据 JSON"><el-input v-model="editingForm.structuredDataText" type="textarea" :rows="4" placeholder='{"@type":"Organization"}' /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingContent" @click="saveContent">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="draftDetailVisible" title="销售草稿详情" width="min(820px, calc(100vw - 28px))" class="ops-dialog" destroy-on-close>
      <el-alert type="warning" :closable="false" show-icon title="仅供人工审核：此记录不会自动创建正式客户、订单、库存或生产任务。" />
      <pre class="draft-detail-json">{{ JSON.stringify(draftDetail || {}, null, 2) }}</pre>
    </el-dialog>

    <el-dialog v-model="customerMatchVisible" title="客户匹配建议" width="min(680px, calc(100vw - 28px))" class="ops-dialog" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon title="以下仅是重复客户候选，必须由人工确认；系统不会自动合并线索。" />
      <div v-if="customerMatch?.suggestions?.length" class="match-list">
        <div v-for="suggestion in customerMatch.suggestions" :key="suggestion.candidateLeadId" class="match-item">
          <div><strong>{{ suggestion.companyName || '未填写企业' }}</strong><span>{{ suggestion.contactName || '未填写联系人' }}</span></div>
          <el-tag type="warning" effect="plain">{{ suggestion.score }} 分</el-tag>
          <small>{{ (suggestion.reasons || []).join(' · ') }}</small>
        </div>
      </div>
      <el-empty v-else description="没有达到建议阈值的候选线索" :image-size="72" />
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Collection,
  DataBoard,
  DataAnalysis,
  Document,
  Edit,
  DocumentChecked,
  Plus,
  Promotion,
  Refresh,
  Setting,
  Tickets,
  TrendCharts,
  User,
  Warning,
  WarningFilled
} from '@element-plus/icons-vue'
import request from '@/utils/request'
import { getUserInfo } from '@/utils/auth'
import { useRouter } from 'vue-router'

const COMPANY_SITE_READ_ROLES = new Set([
  'super_admin', 'admin', 'company_site_admin', 'site_admin', 'content_editor',
  'content_reviewer', 'sales_manager', 'sales_owner', 'sales', 'production_planner', 'system_admin'
])
const COMPANY_SITE_MANAGE_ROLES = new Set([
  'super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_reviewer'
])
const COMPANY_SITE_SCOPES = ['company_site', 'company-site', 'companysite', 'site_content']
const READ_ACTIONS = ['read', 'view', 'list', 'manage', 'admin']
const MANAGE_ACTIONS = ['write', 'publish', 'manage', 'admin']

const activeSection = ref('overview')
const router = useRouter()
const activeContentType = ref('pages')
const loading = ref(false)
const contentLoading = ref(false)
const leadsLoading = ref(false)
const draftsLoading = ref(false)
const seoLoading = ref(false)
const keywordMapLoading = ref(false)
const savingSite = ref(false)
const publishingSite = ref(false)
const savingContent = ref(false)
const factLoading = ref(false)
const geoLoading = ref(false)
const correctionsLoading = ref(false)
const editDialogVisible = ref(false)
const editingType = ref('page')
const editingId = ref('')
const loadError = ref('')
const canRead = ref(false)
const canManage = ref(false)
const canAudit = ref(false)
const canContentWrite = ref(false)
const canPublish = ref(false)
const canSiteWrite = ref(false)
const canSalesWrite = ref(false)
const canSalesApprove = ref(false)
const canSalesPrecheck = ref(false)
const site = ref(null)
const leads = ref([])
const drafts = ref([])
const seoChecks = ref([])
const keywordMapReport = ref(null)
const draftDetailVisible = ref(false)
const draftDetail = ref(null)
const customerMatchVisible = ref(false)
const customerMatch = ref(null)
const factReport = ref(null)
const correctionTasks = ref([])
const geoSnapshots = ref([])
const correctionFilter = ref('open')
  const contentCollections = reactive({
  pages: [],
  products: [],
  solutions: [],
  cases: [],
  certificates: [],
  downloads: [],
  evidence: [],
  knowledge: [],
  seo: [],
  keywords: [],
  externalProfiles: []
})

const contentTypes = [
  { key: 'pages', label: '页面', singular: 'page' },
  { key: 'products', label: '产品', singular: 'product' },
  { key: 'solutions', label: '行业方案', singular: 'solution' },
  { key: 'cases', label: '客户案例', singular: 'case' },
  { key: 'certificates', label: '证书验证', singular: 'certificate' },
  { key: 'downloads', label: '资料下载', singular: 'download' },
  { key: 'evidence', label: '证据记录', singular: 'evidence' },
  { key: 'knowledge', label: '知识文档', singular: 'knowledge' },
  { key: 'seo', label: 'SEO 元数据', singular: 'seo' },
  { key: 'keywords', label: '关键词地图', singular: 'keyword' },
  { key: 'externalProfiles', label: '外部档案', singular: 'externalProfile' }
]

const emptyContentForm = () => ({
  locale: 'zh-CN',
  slugOrPath: '',
  pageType: 'page',
  productCode: '',
  category: '',
  title: '',
  summary: '',
  industry: '',
  scenario: '',
  scope: '',
  issuer: '',
  certificateNumber: '',
  validFrom: '',
  validTo: '',
  description: '',
  fileName: '',
  mimeType: '',
  assetUrl: '',
  accessPolicy: 'lead_required',
  publicLevel: 'anonymous',
  sourceType: 'internal_document',
  sourceRef: '',
  claim: '',
  expiresAt: '',
  keyword: '',
  keywordType: 'secondary',
  intent: 'commercial',
  market: '',
  customerRole: '',
  targetPath: '',
  source: '',
  ownerId: '',
  priority: 3,
  profileType: 'directory',
  verificationStatus: 'pending',
  lastCheckedAt: '',
  profileName: '',
  canonicalName: '',
  url: '',
  notes: '',
  documentType: 'faq',
  content: '',
  question: '',
  answer: '',
  canonical: '',
  robots: 'index,follow',
  applicationsText: '[]',
  specificationsText: '{}',
  deliveryText: '{}',
  evidenceIdsText: '[]',
  blocksText: '[]',
  contentText: '{}',
  seoText: '{}',
  evidenceText: '{}',
  citationsText: '[]',
  forbiddenClaimsText: '[]',
  keywordsText: '[]',
  structuredDataText: '{}'
})

const editingForm = reactive(emptyContentForm())

const activeContentTypeInfo = computed(() => contentTypes.find((item) => item.key === activeContentType.value) || contentTypes[0])
const activeContentTypeLabel = computed(() => activeContentTypeInfo.value.label)
const activeContentRows = computed(() => contentCollections[activeContentType.value] || [])
const hasLocaleField = computed(() => ['pages', 'solutions', 'cases', 'certificates', 'downloads', 'knowledge', 'seo', 'keywords', 'externalProfiles'].includes(activeContentType.value) || ['page', 'solution', 'case', 'certificate', 'download', 'knowledge', 'seo', 'keyword', 'externalProfile'].includes(editingType.value))
const hasSlugField = computed(() => ['pages', 'solutions', 'cases', 'certificates', 'downloads'].includes(activeContentType.value) || ['page', 'solution', 'case', 'certificate', 'download'].includes(editingType.value))
const hasTitleField = computed(() => ['pages', 'solutions', 'cases', 'certificates', 'downloads', 'seo'].includes(activeContentType.value) || ['page', 'solution', 'case', 'certificate', 'download', 'seo'].includes(editingType.value))
const draftFilter = ref('')

const draftTypeText = (value) => ({ opportunity: '商机草稿', quote: '报价草稿', order: '销售订单草稿', production: '生产建议草稿' }[value] || value || '销售草稿')
const draftApprovalText = (value) => ({ pending: '待人工批准', approved: '已批准' }[value] || value || '待人工批准')
const draftApprovalType = (value) => ({ pending: 'warning', approved: 'success' }[value] || 'info')
const draftLeadRef = (row) => row?.source?.leadId || row?.source?.lead_id || row?.leadId || row?.lead_id || '-'
const keywordTypeText = (value) => ({ primary: '主词', secondary: '辅助词', supporting: '支持词' }[value] || value || '辅助词')
const keywordIntentText = (value) => ({ informational: '信息型', commercial: '商业型', transactional: '交易型', navigational: '导航型' }[value] || value || '商业型')

const allContentRows = computed(() => Object.entries(contentCollections).flatMap(([type, rows]) => (rows || []).map((row) => ({
  ...row,
  _type: type,
  typeText: contentTypes.find((item) => item.key === type)?.label || type,
  title: contentTitle(row, type),
  updatedAt: row.updatedAt || row.updated_at || ''
}))))

const recentContentRows = computed(() => [...allContentRows.value]
  .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  .slice(0, 6))

const contentCount = computed(() => allContentRows.value.length)
const publishedContentCount = computed(() => allContentRows.value.filter((row) => row.status === 'published').length)
const newLeadCount = computed(() => leads.value.filter((row) => row.status === 'new').length)
const seoOpenCount = computed(() => seoChecks.value.filter((row) => row.status !== 'resolved').length)
const factSummary = computed(() => {
  const report = factReport.value
  if (!report) return { label: '尚未扫描', detail: '运行扫描以检查事实来源和冲突', openTasks: correctionTasks.value.filter((row) => ['open', 'in_progress'].includes(row.status)).length, expired: 0, conflicts: 0 }
  return {
    label: report.summary?.issues ? '需要处理' : '基础检查通过',
    detail: `${report.summary?.issues || 0} 个问题 · ${formatDate(report.generatedAt)}`,
    openTasks: report.summary?.openTasks || 0,
    expired: report.summary?.expired || 0,
    conflicts: report.summary?.conflicts || 0
  }
})

const summaryCards = computed(() => [
  { key: 'content', label: '内容资产', value: contentCount.value, foot: `${publishedContentCount.value} 条已发布`, tone: 'blue', icon: Collection },
  { key: 'leads', label: '询盘线索', value: leads.value.length, foot: `${newLeadCount.value} 条待跟进`, tone: 'green', icon: User },
  { key: 'published', label: '站点版本', value: `v${site.value?.publishedVersion || 0}`, foot: siteStatusText(site.value?.status), tone: 'purple', icon: Promotion },
  { key: 'seo', label: 'SEO 待处理', value: seoOpenCount.value, foot: seoOpenCount.value ? '建议及时修复' : '当前无问题', tone: seoOpenCount.value ? 'orange' : 'green', icon: TrendCharts }
])

const siteForm = reactive({
  legalName: '',
  brandName: '',
  brandShortName: '',
  factoryName: '',
  domain: '',
  defaultLocale: 'zh-CN',
  enabledLocalesText: '["zh-CN"]',
  themeText: '{}',
  contactText: '{}',
  seoText: '{}'
})

const operationSteps = computed(() => {
  const hasDraft = allContentRows.value.some((row) => row.status === 'draft')
  const hasReview = allContentRows.value.some((row) => ['review', 'approved'].includes(row.status))
  const isPublished = site.value?.status === 'published'
  return [
    { key: 'content', name: '内容准备', icon: Collection, state: hasDraft ? 'attention' : 'done', stateText: hasDraft ? '有草稿' : '已就绪' },
    { key: 'review', name: '审核校验', icon: Document, state: hasReview ? 'attention' : 'done', stateText: hasReview ? '待审核' : '已通过' },
    { key: 'publish', name: '站点发布', icon: Promotion, state: isPublished ? 'done' : 'attention', stateText: isPublished ? '已发布' : '待发布' },
    { key: 'leads', name: '线索承接', icon: User, state: leads.value.length ? 'done' : 'idle', stateText: leads.value.length ? '持续沉淀' : '等待线索' }
  ]
})

const attentionItems = computed(() => {
  const items = []
  if (site.value?.status !== 'published') items.push({ key: 'site', text: '站点配置尚未发布，公开站点可能仍使用旧版本。', section: 'settings', tone: 'orange' })
  if (allContentRows.value.some((row) => row.status === 'draft')) items.push({ key: 'draft', text: '存在未提交审核的内容草稿。', section: 'content', tone: 'blue' })
  if (seoOpenCount.value) items.push({ key: 'seo', text: `SEO 检查发现 ${seoOpenCount.value} 项待处理问题。`, section: 'seo', tone: 'red' })
  if (newLeadCount.value) items.push({ key: 'lead', text: `有 ${newLeadCount.value} 条新线索等待跟进。`, section: 'leads', tone: 'green' })
  return items.slice(0, 4)
})

const seoSummary = computed(() => {
  const total = seoChecks.value.length
  const critical = seoChecks.value.filter((row) => ['critical', 'error'].includes(row.severity)).length
  const resolved = seoChecks.value.filter((row) => row.status === 'resolved').length
  return {
    total,
    critical,
    resolved,
    label: total ? (critical ? '需要修复' : '基础检查通过') : '尚未检查',
    detail: total ? `${resolved}/${total} 项已解决` : '运行一次检查即可生成结果'
  }
})

const textValue = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback
  return String(value)
}

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value
  try {
    const parsed = JSON.parse(String(value || ''))
    return parsed === null || parsed === undefined ? fallback : parsed
  } catch {
    return fallback
  }
}

const jsonText = (value, fallback = {}) => JSON.stringify(value === undefined || value === null ? fallback : value, null, 2)

const syncSiteForm = (value) => {
  const next = value || {}
  siteForm.legalName = textValue(next.legalName || next.legal_name)
  siteForm.brandName = textValue(next.brandName || next.brand_name)
  siteForm.brandShortName = textValue(next.brandShortName || next.brand_short_name)
  siteForm.factoryName = textValue(next.factoryName || next.factory_name)
  siteForm.domain = textValue(next.domain)
  siteForm.defaultLocale = textValue(next.defaultLocale || next.default_locale, 'zh-CN')
  siteForm.enabledLocalesText = jsonText(next.enabledLocales || next.enabled_locales || ['zh-CN'], ['zh-CN'])
  siteForm.themeText = jsonText(next.theme, {})
  siteForm.contactText = jsonText(next.contact, {})
  siteForm.seoText = jsonText(next.seo, {})
}

const siteStatusText = (value) => ({
  draft: '草稿待发布',
  published: '已发布',
  suspended: '已暂停',
  archived: '已归档'
}[value] || '未配置')

const siteStatusType = (value) => ({ published: 'success', suspended: 'warning', archived: 'info', draft: 'warning' }[value] || 'info')

const statusText = (value) => ({
  draft: '草稿',
  review: '待审核',
  approved: '已审核',
  published: '已发布',
  expired: '已过期',
  archived: '已归档'
}[value] || value || '未知')

const statusTagType = (value) => ({
  draft: 'info',
  review: 'warning',
  approved: 'success',
  published: 'success',
  expired: 'danger',
  archived: 'info'
}[value] || 'info')

const leadStatusText = (value) => ({
  new: '新线索', qualified: '已筛选', assigned: '已分配', contacted: '已联系', won: '已成交', lost: '已流失', spam: '垃圾线索', archived: '已归档'
}[value] || value || '未知')

const leadStatusType = (value) => ({ new: 'warning', qualified: 'primary', assigned: 'primary', contacted: 'success', won: 'success', lost: 'info', spam: 'danger', archived: 'info' }[value] || 'info')

const severityText = (value) => ({ critical: '严重', error: '错误', warning: '警告', info: '提示' }[value] || value || '提示')
const severityTagType = (value) => ({ critical: 'danger', error: 'danger', warning: 'warning', info: 'info' }[value] || 'info')
const correctionStatusText = (value) => ({ open: '待处理', in_progress: '处理中', resolved: '已解决', dismissed: '已忽略' }[value] || value || '未知')
const correctionStatusType = (value) => ({ open: 'danger', in_progress: 'warning', resolved: 'success', dismissed: 'info' }[value] || 'info')
const accuracyStatusText = (value) => ({ pending: '待复核', verified: '准确', incorrect: '错误', needs_review: '待复核' }[value] || value || '待复核')
const accuracyStatusType = (value) => ({ pending: 'warning', verified: 'success', incorrect: 'danger', needs_review: 'warning' }[value] || 'info')

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return textValue(value)
  return date.toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-')
}

const detailText = (value) => {
  if (!value) return '-'
  if (typeof value === 'string') return value
  return value.message || value.detail || Object.values(value).find((item) => typeof item === 'string') || '检查结果已记录'
}

const contentTitle = (row, type) => {
  if (!row) return '-'
  if (type === 'pages') return row.title || row.slug || '-'
  if (type === 'products') return row.productCode || row.product_code || row.slug || '-'
  if (type === 'keywords') return row.keyword || '-'
  if (type === 'externalProfiles') return row.name || row.canonicalName || '-'
  if (type === 'evidence') return row.claim || row.sourceRef || '-'
  if (type === 'knowledge') return row.question || row.title || '-'
  if (type === 'certificates') return row.title || row.name || row.number || '-'
  if (type === 'downloads') return row.title || row.fileName || row.slug || '-'
  return row.title || row.slug || row.path || row.documentType || '-'
}

const contentMeta = (row, type) => {
  if (!row) return '-'
  if (type === 'products') return row.category || row.slug || '-'
  if (type === 'keywords') return `${row.market || '未设市场'} · ${row.targetPath || '未映射'}`
  if (type === 'externalProfiles') return `${row.profileType || 'directory'} · ${row.verificationStatus || 'pending'}`
  if (type === 'evidence') return row.sourceType || '-'
  if (type === 'knowledge') return row.locale || 'FAQ'
  if (type === 'certificates') return `${row.issuer || '证书'} · ${row.publicLevel === 'public' ? '公开' : '内部'}`
  if (type === 'downloads') return `${row.locale || 'zh-CN'} · ${row.accessPolicy || 'lead_required'}`
  return row.locale || row.path || '-'
}

const refreshAuthState = () => {
  const info = getUserInfo()
  const roles = [info.app_role, info.appRole, info.role, info.role_code, info.roleCode, info.dbRole, info.db_role]
    .map((value) => textValue(value).trim().toLowerCase())
  const permissions = Array.isArray(info.permissions) ? info.permissions : []
  const hasScopedPermission = (actions) => permissions.some((permission) => {
    const value = textValue(permission).trim().toLowerCase()
    if (value === '*') return true
    const scoped = COMPANY_SITE_SCOPES.some((scope) => value === scope || value.includes(`${scope}:`) || value.includes(`${scope}.`) || value.includes(`${scope}/`))
    return scoped && actions.some((action) => value === action || value.includes(`:${action}`) || value.includes(`.${action}`) || value.includes(`/${action}`) || value.includes(action))
  })
  const isRole = (allowed) => roles.some((role) => allowed.has(role))
  canRead.value = isRole(COMPANY_SITE_READ_ROLES) || hasScopedPermission(READ_ACTIONS)
  canContentWrite.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_editor', 'content_reviewer'])) || hasScopedPermission(['content:write', 'content', 'write'])
  canPublish.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_reviewer'])) || hasScopedPermission(['content:publish', 'publish'])
  canSiteWrite.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin'])) || hasScopedPermission(['site:write', 'site', 'write'])
  canSalesWrite.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'sales_manager', 'sales_owner', 'sales', 'production_planner'])) || hasScopedPermission(['sales:write', 'sales', 'write'])
  canSalesApprove.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'sales_manager', 'production_planner'])) || hasScopedPermission(['sales:approve', 'approve'])
  canSalesPrecheck.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'sales_manager', 'sales_owner', 'production_planner'])) || hasScopedPermission(['sales:precheck', 'precheck'])
  canManage.value = canContentWrite.value || canPublish.value || canSiteWrite.value
  canAudit.value = isRole(new Set(['super_admin', 'admin', 'system_admin', 'company_site_admin', 'site_admin', 'content_reviewer', 'sales_manager', 'sales_owner', 'sales', 'production_planner'])) || hasScopedPermission(['audit', 'facts', 'geo', 'manage'])
}

const loadSite = async () => {
  const response = await request.get('/company-site/admin/site-config')
  site.value = response?.config?.site || response?.site || null
  syncSiteForm(site.value)
}

const loadContent = async (type = activeContentType.value) => {
  if (!contentCollections[type]) return
  contentLoading.value = true
  try {
    const collection = type === 'knowledge' ? 'faq' : type === 'externalProfiles' ? 'external-profiles' : type
    const response = await request.get(`/company-site/admin/${collection}`, { params: { limit: 200 } })
    contentCollections[type] = Array.isArray(response?.items) ? response.items : []
  } finally {
    contentLoading.value = false
  }
}

const loadContentCatalog = async () => {
  await Promise.all(contentTypes.map((type) => loadContent(type.key)))
}

const loadLeads = async () => {
  leadsLoading.value = true
  try {
    const response = await request.get('/company-site/admin/leads', { params: { limit: 200 } })
    leads.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    leadsLoading.value = false
  }
}

const loadDrafts = async () => {
  if (!canSalesWrite.value && !canSalesApprove.value) return
  draftsLoading.value = true
  try {
    const response = await request.get('/sales/drafts', { params: { type: draftFilter.value || undefined } })
    drafts.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    draftsLoading.value = false
  }
}

const loadKeywordMap = async () => {
  if (!canAudit.value) return
  keywordMapLoading.value = true
  try {
    const response = await request.get('/company-site/admin/reports/keyword-map', { params: { locale: site.value?.defaultLocale || 'zh-CN' } })
    keywordMapReport.value = response?.report || null
  } finally {
    keywordMapLoading.value = false
  }
}

const openDraft = async (row) => {
  const response = await request.get(`/sales/drafts/${encodeURIComponent(row.draftType)}/${encodeURIComponent(row.id)}`)
  draftDetail.value = response?.draft || row
  draftDetailVisible.value = true
}

const approveDraft = async (row) => {
  if (!canSalesApprove.value) return
  await ElMessageBox.confirm(`确认批准${draftTypeText(row.draftType)}吗？这仍然只是内部草稿。`, '人工批准', { type: 'warning' })
  await request.post(`/sales/drafts/${encodeURIComponent(row.draftType)}/${encodeURIComponent(row.id)}/approve`, {})
  await loadDrafts()
  ElMessage.success('草稿已记录人工批准')
}

const precheckDraft = async (row) => {
  if (!canSalesPrecheck.value) return
  const response = await request.post(`/sales/orders/${encodeURIComponent(row.id)}/precheck`, {})
  draftDetail.value = { ...row, precheck: response?.precheck || null }
  draftDetailVisible.value = true
}

const runCustomerMatch = async (row) => {
  if (!canSalesWrite.value) return
  const leadId = row?.id
  if (!leadId) return
  const response = await request.post(`/sales/leads/${encodeURIComponent(leadId)}/customer-match`, {}, { headers: { 'Idempotency-Key': `customer-match-${leadId}` } })
  customerMatch.value = response?.match || null
  customerMatchVisible.value = true
}

const loadSeoChecks = async () => {
  seoLoading.value = true
  try {
    const response = await request.get('/company-site/admin/seo/checks', { params: { limit: 200 } })
    seoChecks.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    seoLoading.value = false
  }
}

const loadCorrectionTasks = async () => {
  if (!canAudit.value) return
  correctionsLoading.value = true
  try {
    const response = await request.get('/company-site/admin/facts/corrections', { params: { status: correctionFilter.value } })
    correctionTasks.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    correctionsLoading.value = false
  }
}

const loadGeoSnapshots = async () => {
  if (!canAudit.value) return
  geoLoading.value = true
  try {
    const response = await request.get('/company-site/admin/geo/snapshots', { params: { locale: site.value?.defaultLocale || 'zh-CN' } })
    geoSnapshots.value = Array.isArray(response?.items) ? response.items : []
  } finally {
    geoLoading.value = false
  }
}

const loadFactGovernance = async () => {
  if (!canAudit.value) return
  await Promise.all([loadCorrectionTasks(), loadGeoSnapshots()])
}

const loadAll = async () => {
  refreshAuthState()
  if (!canRead.value) {
    loadError.value = '当前账号没有企业站点运营权限，请联系管理员分配站点读取权限。'
    return
  }
  loading.value = true
  loadError.value = ''
  const results = await Promise.allSettled([loadSite(), loadContentCatalog(), loadLeads(), loadDrafts(), loadSeoChecks(), loadKeywordMap(), loadFactGovernance()])
  const failed = results.find((item) => item.status === 'rejected')
  if (failed) loadError.value = '部分运营数据暂时无法加载，请检查运行时服务或稍后重试。'
  loading.value = false
}

const openCueBuilder = () => router.push('/cue-builder')
const openFactoryDemo = () => router.push('/factory-demo')

const saveSite = async () => {
  if (!canSiteWrite.value) return
  const enabledLocales = parseJson(siteForm.enabledLocalesText, [])
  if (!Array.isArray(enabledLocales) || !enabledLocales.length) {
    ElMessage.warning('启用语言必须是至少包含一种语言的 JSON 数组')
    return
  }
  savingSite.value = true
  try {
    const response = await request.patch('/company-site/admin/site-config', {
      legalName: siteForm.legalName,
      brandName: siteForm.brandName,
      brandShortName: siteForm.brandShortName,
      factoryName: siteForm.factoryName,
      domain: siteForm.domain,
      defaultLocale: siteForm.defaultLocale,
      enabledLocales,
      theme: parseJson(siteForm.themeText, {}),
      contact: parseJson(siteForm.contactText, {}),
      seo: parseJson(siteForm.seoText, {})
    })
    site.value = response?.config?.site || response?.site || site.value
    syncSiteForm(site.value)
    ElMessage.success('站点设置已保存为草稿')
  } finally {
    savingSite.value = false
  }
}

const publishSite = async () => {
  if (!canPublish.value) return
  try {
    await ElMessageBox.confirm('发布后将把当前站点配置切换到公开版本，是否继续？', '确认发布站点', { type: 'warning' })
  } catch {
    return
  }
  publishingSite.value = true
  try {
    const response = await request.post('/company-site/admin/site-config/publish', {})
    if (response?.config?.site) site.value = response.config.site
    await loadSite()
    ElMessage.success('站点已发布')
  } finally {
    publishingSite.value = false
  }
}

const newContent = (type) => {
  if (!canContentWrite.value) return
  const info = contentTypes.find((item) => item.key === type)
  if (!info || type === 'seo') {
    if (type === 'seo') ElMessage.info('SEO 元数据可通过站点内容或 SEO 检查结果继续维护')
    return
  }
  editingType.value = info.singular
  editingId.value = ''
  Object.assign(editingForm, emptyContentForm())
  if (editingType.value === 'certificate') editingForm.publicLevel = 'internal'
  if (editingType.value === 'externalProfile') editingForm.profileType = 'directory'
  editDialogVisible.value = true
}

const readRowValue = (row, camel, snake = '') => row?.[camel] ?? (snake ? row?.[snake] : undefined)

const editContent = (type, row) => {
  const info = contentTypes.find((item) => item.key === type)
  if (!info || !row) return
  editingType.value = info.singular
  editingId.value = textValue(row.id)
  Object.assign(editingForm, emptyContentForm())
  editingForm.locale = textValue(readRowValue(row, 'locale'), 'zh-CN')
  editingForm.slugOrPath = textValue(readRowValue(row, 'slug', 'path'))
  editingForm.pageType = textValue(readRowValue(row, 'pageType', 'page_type'), 'page')
  editingForm.productCode = textValue(readRowValue(row, 'productCode', 'product_code'))
  editingForm.category = textValue(readRowValue(row, 'category'))
  editingForm.title = textValue(readRowValue(row, 'title'))
  editingForm.summary = textValue(readRowValue(row, 'summary'))
  editingForm.industry = textValue(readRowValue(row, 'industry'))
  editingForm.scenario = textValue(readRowValue(row, 'scenario'))
  editingForm.scope = textValue(readRowValue(row, 'scope'))
  editingForm.issuer = textValue(readRowValue(row, 'issuer'))
  editingForm.certificateNumber = textValue(readRowValue(row, 'number', 'certificate_number'))
  editingForm.validFrom = textValue(readRowValue(row, 'validFrom', 'valid_from'))
  editingForm.validTo = textValue(readRowValue(row, 'validTo', 'valid_to'))
  editingForm.description = textValue(readRowValue(row, 'description'))
  editingForm.fileName = textValue(readRowValue(row, 'fileName', 'file_name'))
  editingForm.mimeType = textValue(readRowValue(row, 'mimeType', 'mime_type'))
  editingForm.assetUrl = textValue(readRowValue(row, 'assetUrl', 'asset_url'))
  editingForm.accessPolicy = textValue(readRowValue(row, 'accessPolicy', 'access_policy'), 'lead_required')
  editingForm.publicLevel = textValue(readRowValue(row, 'publicLevel', 'public_level'), editingType.value === 'certificate' ? 'internal' : 'anonymous')
  editingForm.sourceType = textValue(readRowValue(row, 'sourceType', 'source_type'), 'internal_document')
  editingForm.sourceRef = textValue(readRowValue(row, 'sourceRef', 'source_ref'))
  editingForm.claim = textValue(readRowValue(row, 'claim'))
  editingForm.expiresAt = textValue(readRowValue(row, 'expiresAt', 'expires_at'))
  editingForm.keyword = textValue(readRowValue(row, 'keyword'))
  editingForm.keywordType = textValue(readRowValue(row, 'keywordType', 'keyword_type'), 'secondary')
  editingForm.intent = textValue(readRowValue(row, 'intent'), 'commercial')
  editingForm.market = textValue(readRowValue(row, 'market'))
  editingForm.customerRole = textValue(readRowValue(row, 'customerRole', 'customer_role'))
  editingForm.targetPath = textValue(readRowValue(row, 'targetPath', 'target_path'))
  editingForm.source = textValue(readRowValue(row, 'source'))
  editingForm.ownerId = textValue(readRowValue(row, 'ownerId', 'owner_id'))
  editingForm.priority = Number(readRowValue(row, 'priority')) || 3
  editingForm.profileType = textValue(readRowValue(row, 'profileType', 'profile_type'), 'directory')
  editingForm.verificationStatus = textValue(readRowValue(row, 'verificationStatus', 'verification_status'), 'pending')
  editingForm.lastCheckedAt = textValue(readRowValue(row, 'lastCheckedAt', 'last_checked_at'))
  editingForm.profileName = textValue(readRowValue(row, 'name'))
  editingForm.canonicalName = textValue(readRowValue(row, 'canonicalName', 'canonical_name'))
  editingForm.url = textValue(readRowValue(row, 'url'))
  editingForm.notes = textValue(readRowValue(row, 'notes'))
  editingForm.documentType = textValue(readRowValue(row, 'documentType', 'document_type'), 'faq')
  editingForm.content = textValue(readRowValue(row, 'content'))
  editingForm.question = textValue(readRowValue(row, 'question'))
  editingForm.answer = textValue(readRowValue(row, 'answer'))
  editingForm.description = textValue(readRowValue(row, 'description'))
  editingForm.canonical = textValue(readRowValue(row, 'canonical'))
  editingForm.robots = textValue(readRowValue(row, 'robots'), 'index,follow')
  editingForm.applicationsText = jsonText(readRowValue(row, 'applications'), [])
  editingForm.specificationsText = jsonText(readRowValue(row, 'specifications'), {})
  editingForm.deliveryText = jsonText(readRowValue(row, 'delivery'), {})
  editingForm.evidenceIdsText = jsonText(readRowValue(row, 'evidenceIds', 'evidence_ids'), [])
  editingForm.blocksText = jsonText(readRowValue(row, 'blocks'), [])
  editingForm.contentText = jsonText(readRowValue(row, 'content'), {})
  editingForm.seoText = jsonText(readRowValue(row, 'seo'), {})
  editingForm.evidenceText = jsonText(readRowValue(row, 'evidence'), {})
  editingForm.citationsText = jsonText(readRowValue(row, 'citations'), [])
  editingForm.forbiddenClaimsText = jsonText(readRowValue(row, 'forbiddenClaims', 'forbidden_claims'), [])
  editingForm.keywordsText = jsonText(readRowValue(row, 'keywords'), [])
  editingForm.structuredDataText = jsonText(readRowValue(row, 'structuredData', 'structured_data'), {})
  editDialogVisible.value = true
}

const buildContentPayload = () => {
  const form = editingForm
  if (editingType.value === 'page') return { locale: form.locale, slug: form.slugOrPath, pageType: form.pageType, title: form.title, summary: form.summary, blocks: parseJson(form.blocksText, []), seo: parseJson(form.seoText, {}) }
  if (editingType.value === 'product') return { productCode: form.productCode, slug: form.slugOrPath, category: form.category, applications: parseJson(form.applicationsText, []), specifications: parseJson(form.specificationsText, {}), delivery: parseJson(form.deliveryText, {}), evidenceIds: parseJson(form.evidenceIdsText, []) }
  if (editingType.value === 'solution') return { locale: form.locale, slug: form.slugOrPath, title: form.title, industry: form.industry, scenario: form.scenario, content: parseJson(form.contentText, {}), seo: parseJson(form.seoText, {}) }
  if (editingType.value === 'case') return { locale: form.locale, slug: form.slugOrPath, title: form.title, industry: form.industry, scope: form.scope, publicLevel: form.publicLevel, content: parseJson(form.contentText, {}), evidenceIds: parseJson(form.evidenceIdsText, []) }
  if (editingType.value === 'certificate') return { locale: form.locale, slug: form.slugOrPath, name: form.title, description: form.description, issuer: form.issuer, number: form.certificateNumber, validFrom: form.validFrom, validTo: form.validTo, publicLevel: form.publicLevel, evidence: parseJson(form.evidenceText, {}) }
  if (editingType.value === 'download') return { locale: form.locale, slug: form.slugOrPath, title: form.title, description: form.description, fileName: form.fileName, mimeType: form.mimeType, assetUrl: form.assetUrl, accessPolicy: form.accessPolicy, expiresAt: form.expiresAt }
  if (editingType.value === 'evidence') return { claim: form.claim, sourceType: form.sourceType, sourceRef: form.sourceRef, evidence: parseJson(form.evidenceText, {}), expiresAt: form.expiresAt }
  if (editingType.value === 'knowledge') return { locale: form.locale, question: form.question, answer: form.answer, documentType: form.documentType, citations: parseJson(form.citationsText, []), forbiddenClaims: parseJson(form.forbiddenClaimsText, []), expiresAt: form.expiresAt }
  if (editingType.value === 'keyword') return { locale: form.locale, keyword: form.keyword, keywordType: form.keywordType, intent: form.intent, market: form.market, customerRole: form.customerRole, targetPath: form.targetPath, source: form.source, ownerId: form.ownerId, priority: form.priority }
  if (editingType.value === 'externalProfile') return { locale: form.locale, profileType: form.profileType, name: form.profileName, canonicalName: form.canonicalName, url: form.url, market: form.market, verificationStatus: form.verificationStatus, lastCheckedAt: form.lastCheckedAt, expiresAt: form.expiresAt, evidenceIds: parseJson(form.evidenceIdsText, []), ownerId: form.ownerId, notes: form.notes }
  return { locale: form.locale, path: form.slugOrPath, title: form.title, description: form.description, canonical: form.canonical, robots: form.robots, keywords: parseJson(form.keywordsText, []), structuredData: parseJson(form.structuredDataText, {}) }
}

const saveContent = async () => {
  if (!canContentWrite.value) return
  if (!editingId.value && editingType.value === 'product' && !editingForm.productCode) return ElMessage.warning('请输入产品编号')
  if (!editingId.value && ['page', 'solution', 'case'].includes(editingType.value) && (!editingForm.locale || !editingForm.slugOrPath || !editingForm.title)) return ElMessage.warning('请补充语言、标识和标题')
  if (!editingId.value && editingType.value === 'knowledge' && (!editingForm.locale || !editingForm.question || !editingForm.answer)) return ElMessage.warning('请补充语言、问题和回答内容')
  if (!editingId.value && editingType.value === 'evidence' && !editingForm.claim) return ElMessage.warning('请输入可验证声明')
  if (!editingId.value && editingType.value === 'keyword' && (!editingForm.locale || !editingForm.keyword || !editingForm.targetPath)) return ElMessage.warning('请补充语言、关键词和目标路径')
  if (!editingId.value && editingType.value === 'externalProfile' && (!editingForm.locale || !editingForm.profileName || !editingForm.canonicalName || !editingForm.url)) return ElMessage.warning('请补充语言、名称、标准名称和 URL')
  if (!editingId.value && ['certificate', 'download'].includes(editingType.value) && (!editingForm.locale || !editingForm.slugOrPath || !editingForm.title)) return ElMessage.warning('请补充语言、标识和标题')
  savingContent.value = true
  try {
    const collection = editingType.value === 'knowledge' ? 'faq' : editingType.value === 'externalProfile' ? 'external-profiles' : editingType.value
    const endpoint = `/company-site/admin/${collection}${editingId.value ? `/${editingId.value}` : ''}`
    await request[editingId.value ? 'patch' : 'post'](endpoint, buildContentPayload())
    editDialogVisible.value = false
    await loadContent(activeContentType.value)
    ElMessage.success('内容草稿已保存')
  } finally {
    savingContent.value = false
  }
}

const nextStatus = (row, type) => {
  if ((!canContentWrite.value && !canPublish.value) || type === 'seo') return ''
  const status = textValue(row?.status, 'draft')
  const chain = ['draft', 'review', 'approved', 'published']
  const index = chain.indexOf(status)
  const next = index >= 0 && index < chain.length - 1 ? chain[index + 1] : ''
  if (next === 'published' && !canPublish.value) return ''
  if (next && next !== 'published' && !canContentWrite.value) return ''
  return next
}

const nextStatusLabel = (row, type) => ({ review: '提交审核', approved: '审核通过', published: '发布' }[nextStatus(row, type)] || '')

const advanceContentStatus = async (type, row) => {
  const status = nextStatus(row, type)
  if (!status) return
  const action = status === 'published' ? '发布' : status === 'review' ? '送审' : '审核通过'
  try {
    await ElMessageBox.confirm(`确定将“${contentTitle(row, type)}”${action}吗？`, `确认${action}`, { type: status === 'published' ? 'warning' : 'info' })
  } catch {
    return
  }
  const objectType = type === 'knowledge' ? 'faq' : (contentTypes.find((item) => item.key === type)?.singular || type)
  const actionPath = status === 'review' ? 'submit-review' : status === 'approved' ? 'approve' : status === 'published' ? 'publish' : ''
  await request.post(`/company-site/admin/content/${actionPath}`, { objectType, objectId: row.id })
  await loadContent(type)
  ElMessage.success(`内容已${action}`)
}

const runSeoCheck = async () => {
  if (!canAudit.value) return
  seoLoading.value = true
  try {
    await request.post('/company-site/admin/seo/audit', {})
    await loadSeoChecks()
    ElMessage.success('SEO 检查已完成')
  } finally {
    seoLoading.value = false
  }
}

const scanFacts = async () => {
  if (!canAudit.value) return
  factLoading.value = true
  try {
    const response = await request.post('/company-site/admin/facts/scan', {})
    factReport.value = response?.report || null
    await loadCorrectionTasks()
    ElMessage.success('事实扫描已完成')
  } finally {
    factLoading.value = false
  }
}

const generateGeoSnapshots = async () => {
  if (!canAudit.value) return
  geoLoading.value = true
  try {
    await request.post('/company-site/admin/geo/snapshots/generate', { platform: 'internal-baseline', locale: site.value?.defaultLocale || 'zh-CN' })
    await loadGeoSnapshots()
    ElMessage.success('GEO 快照已生成，等待人工复核')
  } finally {
    geoLoading.value = false
  }
}

const reviewGeoSnapshot = async (row, accuracyStatus) => {
  if (!canPublish.value) return
  await request.patch(`/company-site/admin/geo/snapshots/${encodeURIComponent(row.id)}/review`, { accuracyStatus })
  await Promise.all([loadGeoSnapshots(), loadCorrectionTasks()])
  ElMessage.success('GEO 快照复核状态已更新')
}

const updateCorrectionStatus = async (row, status) => {
  if (!canContentWrite.value) return
  await request.patch(`/company-site/admin/facts/corrections/${encodeURIComponent(row.id)}`, { status })
  await loadCorrectionTasks()
  ElMessage.success('纠偏任务状态已更新')
}

const handleAuthUpdate = () => {
  refreshAuthState()
  if (canRead.value && !site.value) loadAll()
}

onMounted(() => {
  refreshAuthState()
  window.addEventListener('user-info-updated', handleAuthUpdate)
  loadAll()
})

onUnmounted(() => {
  window.removeEventListener('user-info-updated', handleAuthUpdate)
})
</script>

<style scoped>
.company-site-ops {
  min-height: 100vh;
  padding: clamp(16px, 2.2vw, 28px);
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}

.page-header,
.section-toolbar,
.panel-heading,
.summary-card-top,
.overview-banner,
.workspace-tabs-wrap,
.toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header {
  align-items: flex-end;
  margin: 0 auto 20px;
  max-width: 1500px;
}

.page-heading { min-width: 0; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-primary); box-shadow: 0 0 0 5px var(--el-color-primary-light-9); }
.page-heading h1 { margin: 8px 0 7px; font-size: clamp(21px, 2.4vw, 30px); line-height: 1.2; letter-spacing: -.02em; }
.page-heading p, .section-toolbar p, .panel-heading p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.status-pill { border-radius: 999px; }
.load-alert { max-width: 1500px; margin: 0 auto 16px; }

.summary-grid, .workspace-card { max-width: 1500px; margin-left: auto; margin-right: auto; }
.summary-card { min-height: 132px; border-radius: 12px; border-color: var(--el-border-color-lighter); transition: transform .18s ease, box-shadow .18s ease; }
.summary-card:hover { transform: translateY(-2px); box-shadow: var(--el-box-shadow-light); }
.summary-label { color: var(--el-text-color-secondary); font-size: 13px; }
.summary-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.summary-green .summary-icon { color: var(--el-color-success); background: var(--el-color-success-light-9); }
.summary-purple .summary-icon { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.summary-orange .summary-icon { color: var(--el-color-warning); background: var(--el-color-warning-light-9); }
.summary-value { margin-top: 12px; font-size: 26px; line-height: 1; font-weight: 750; color: var(--el-text-color-primary); }
.summary-foot { margin-top: 10px; color: var(--el-text-color-secondary); font-size: 12px; }

.workspace-card { margin-top: 16px; border-radius: 14px; border-color: var(--el-border-color-lighter); overflow: hidden; }
.workspace-card :deep(.el-card__body) { padding: 0; }
.workspace-tabs-wrap { padding: 0 20px; border-bottom: 1px solid var(--el-border-color-lighter); }
.workspace-tabs { min-width: 0; }
.workspace-tabs :deep(.el-tabs__header) { margin: 0; }
.workspace-tabs :deep(.el-tabs__item span) { display: inline-flex; align-items: center; gap: 6px; }
.overview-section, .content-section, .leads-section, .seo-section, .settings-section { padding: 22px; }
.drafts-section, .facts-section { padding: 22px; }
.overview-banner { padding: 20px 22px; margin-bottom: 18px; border: 1px solid var(--el-color-primary-light-8); border-radius: 12px; background: linear-gradient(120deg, var(--el-color-primary-light-9), var(--el-bg-color)); }
.banner-mark { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 48px; width: 48px; height: 48px; border-radius: 14px; color: #fff; background: var(--el-color-primary); font-size: 24px; box-shadow: 0 8px 18px rgba(var(--el-color-primary-rgb), .22); }
.banner-copy { flex: 1; min-width: 0; }
.banner-title { font-size: 18px; font-weight: 700; }
.banner-subtitle { margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.banner-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.banner-meta strong { color: var(--el-color-primary); font-size: 22px; }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr); gap: 16px; }
.overview-panel, .recent-panel { padding: 18px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }
.recent-panel { margin-top: 16px; }
.panel-heading { align-items: flex-start; }
.panel-heading h2, .section-toolbar h2 { margin: 0 0 5px; font-size: 16px; }
.panel-heading-icon { color: var(--el-color-warning); font-size: 20px; }
.flow-line { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 24px; }
.flow-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; text-align: center; }
.flow-step:not(:last-child)::after { content: ''; position: absolute; top: 18px; left: calc(50% + 26px); right: calc(-50% + 26px); height: 1px; background: var(--el-border-color); }
.flow-step-icon { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; color: var(--el-text-color-secondary); background: var(--el-fill-color); border: 1px solid var(--el-border-color); }
.flow-step.is-done .flow-step-icon { color: var(--el-color-success); border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9); }
.flow-step.is-attention .flow-step-icon { color: var(--el-color-warning); border-color: var(--el-color-warning-light-5); background: var(--el-color-warning-light-9); }
.flow-step-name { font-size: 13px; font-weight: 650; }
.flow-step-state { color: var(--el-text-color-secondary); font-size: 11px; }
.flow-step.is-attention .flow-step-state { color: var(--el-color-warning); }
.attention-list { margin-top: 18px; }
.attention-item { display: flex; align-items: center; gap: 9px; min-height: 39px; border-bottom: 1px solid var(--el-border-color-lighter); }
.attention-item:last-child { border-bottom: none; }
.attention-dot { flex: 0 0 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--el-color-primary); }
.dot-orange { background: var(--el-color-warning); }.dot-red { background: var(--el-color-danger); }.dot-green { background: var(--el-color-success); }.dot-blue { background: var(--el-color-primary); }
.attention-text { flex: 1; min-width: 0; color: var(--el-text-color-regular); font-size: 12px; line-height: 1.5; }
.ops-table { width: 100%; margin-top: 16px; }
.ops-table :deep(.el-table__inner-wrapper::before) { display: none; }
.ops-table :deep(.el-table__row) { cursor: default; }

.section-toolbar { align-items: flex-start; margin-bottom: 18px; }
.toolbar-actions { flex-shrink: 0; }
.content-type-select { width: 130px; }
.content-table { margin-top: 0; }
.site-form, .content-form { max-width: 1080px; }
.form-grid { display: grid; gap: 0 16px; }
.form-grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.site-form :deep(.el-form-item), .content-form :deep(.el-form-item) { margin-bottom: 18px; }
.site-form :deep(.el-textarea__inner), .content-form :deep(.el-textarea__inner) { font-family: var(--el-font-family); line-height: 1.55; }
.seo-overview { display: grid; grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(120px, 1fr)); gap: 12px; }
.seo-score-card, .seo-stat { min-height: 102px; padding: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-blank); }
.seo-score-card { display: flex; flex-direction: column; gap: 6px; }
.seo-score-label, .seo-stat span { color: var(--el-text-color-secondary); font-size: 12px; }
.seo-score-card strong { color: var(--el-color-primary); font-size: 20px; }
.seo-score-card > span:last-child { color: var(--el-text-color-secondary); font-size: 12px; }
.seo-stat { display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.seo-stat strong { font-size: 26px; color: var(--el-text-color-primary); }.seo-stat strong.is-danger { color: var(--el-color-danger); }.seo-stat strong.is-success { color: var(--el-color-success); }
.draft-filter { width: 130px; }.draft-boundary-alert { margin-bottom: 14px; }.draft-detail-json { max-height: 420px; margin: 16px 0 0; padding: 14px; overflow: auto; color: var(--el-text-color-regular); background: var(--el-fill-color-light); border: 1px solid var(--el-border-color-lighter); font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
.keyword-map-panel { margin-top: 20px; padding: 18px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }.keyword-map-summary { display: grid; grid-template-columns: repeat(4, minmax(100px, 1fr)); gap: 10px; margin-top: 16px; }.keyword-map-summary > div { display: flex; flex-direction: column; gap: 7px; min-height: 78px; padding: 12px; border: 1px solid var(--el-border-color-lighter); background: var(--el-fill-color-blank); }.keyword-map-summary span { color: var(--el-text-color-secondary); font-size: 12px; }.keyword-map-summary strong { font-size: 22px; }.keyword-map-summary strong.is-danger { color: var(--el-color-danger); }.keyword-gap-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }.keyword-gap { padding: 5px 8px; color: var(--el-color-danger); border: 1px solid var(--el-color-danger-light-7); background: var(--el-color-danger-light-9); font-size: 11px; }.match-list { display: grid; gap: 10px; margin-top: 16px; }.match-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 12px; padding: 13px; border: 1px solid var(--el-border-color-lighter); }.match-item div { display: flex; flex-direction: column; gap: 3px; }.match-item div span, .match-item small { color: var(--el-text-color-secondary); font-size: 12px; }.match-item small { grid-column: 1 / -1; }
.facts-section { min-width: 0; }
.governance-summary { display: grid; grid-template-columns: minmax(240px, 1.5fr) repeat(3, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
.governance-score, .governance-stat { min-height: 104px; padding: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-blank); }
.governance-score { display: flex; flex-direction: column; gap: 7px; }.governance-label, .governance-stat span { color: var(--el-text-color-secondary); font-size: 12px; }
.governance-score strong { color: var(--el-color-primary); font-size: 20px; }.governance-score small { color: var(--el-text-color-secondary); font-size: 12px; }
.governance-stat { display: flex; flex-direction: column; justify-content: center; gap: 8px; }.governance-stat strong { font-size: 26px; }.governance-stat strong.is-warning { color: var(--el-color-warning); }.governance-stat strong.is-danger { color: var(--el-color-danger); }
.governance-panel { padding: 18px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); }.geo-panel { margin-top: 16px; }
.correction-filter { width: 112px; }.panel-count { display: inline-flex; align-items: center; gap: 6px; color: var(--el-text-color-secondary); font-size: 12px; }.table-secondary { display: block; margin-top: 3px; color: var(--el-text-color-secondary); font-size: 11px; }
.facts-mobile-list { display: none; }.facts-mobile-item { padding: 14px 0; border-bottom: 1px solid var(--el-border-color-lighter); }.facts-mobile-item:last-child { border-bottom: 0; }.facts-mobile-item-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.facts-mobile-code { margin-top: 6px; color: var(--el-color-primary); font-size: 12px; font-weight: 650; }.facts-mobile-item p { margin: 8px 0; color: var(--el-text-color-regular); font-size: 13px; line-height: 1.55; }.facts-mobile-meta { color: var(--el-text-color-secondary); font-size: 11px; }.facts-mobile-actions { display: flex; gap: 12px; margin-top: 8px; }

@media (max-width: 900px) {
  .page-header { align-items: flex-start; flex-direction: column; }
  .page-actions { justify-content: flex-start; }
  .overview-grid { grid-template-columns: 1fr; }
  .seo-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .seo-score-card { grid-column: 1 / -1; }
}

@media (max-width: 640px) {
  .company-site-ops { padding: 14px; }
  .workspace-tabs-wrap { padding: 0 12px; overflow-x: auto; }
  .workspace-tabs { min-width: 540px; }
  .overview-section, .content-section, .leads-section, .drafts-section, .seo-section, .facts-section, .settings-section { padding: 16px; }
  .overview-banner { align-items: flex-start; flex-wrap: wrap; padding: 16px; }
  .banner-copy { flex-basis: calc(100% - 64px); }
  .banner-meta { flex-direction: row; align-items: center; width: 100%; padding-left: 64px; }
  .flow-line { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 8px; }
  .flow-step:nth-child(2)::after { display: none; }
  .flow-step:nth-child(3)::after { display: none; }
  .section-toolbar { flex-direction: column; }
  .toolbar-actions { width: 100%; justify-content: flex-start; }
  .content-type-select { flex: 1; }
  .form-grid-two, .form-grid-three { grid-template-columns: 1fr; }
  .seo-overview { grid-template-columns: 1fr 1fr; }
  .seo-score-card { grid-column: 1 / -1; }
  .governance-summary { grid-template-columns: 1fr 1fr; }
  .governance-score { grid-column: 1 / -1; }
  .keyword-map-summary { grid-template-columns: 1fr 1fr; }
  .facts-desktop-table { display: none; }
  .facts-mobile-list { display: block; }
  .page-heading h1 { font-size: 22px; }
}
</style>
