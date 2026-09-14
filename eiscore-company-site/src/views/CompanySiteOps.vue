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
          <el-tab-pane name="drafts" :disabled="!featureAvailability.salesDrafts">
            <template #label><span><el-icon><Document /></el-icon>销售草稿（待接入）</span></template>
          </el-tab-pane>
          <el-tab-pane name="seo">
            <template #label><span><el-icon><TrendCharts /></el-icon>SEO / GEO</span></template>
          </el-tab-pane>
          <el-tab-pane name="facts" :disabled="!featureAvailability.factGovernance">
            <template #label><span><el-icon><DocumentChecked /></el-icon>事实治理（待接入）</span></template>
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
              <el-option v-for="type in contentTypes" :key="type.key" :label="type.enabled ? type.label : `${type.label}（待接入）`" :value="type.key" :disabled="!type.enabled" />
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
          <el-table-column v-if="featureAvailability.customerMatch && canSalesWrite" label="处理" width="130" fixed="right">
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
            <el-tag v-if="!featureAvailability.keywordMapReport" type="info" effect="plain">报告接口待接入</el-tag>
            <el-button v-else-if="canAudit" link type="primary" :loading="keywordMapLoading" @click="loadKeywordMap">刷新地图</el-button>
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

        <div v-if="featureAvailability.geoSnapshots" class="governance-panel geo-panel seo-geo-panel">
          <div class="panel-heading">
            <div><h2>GEO 回答快照</h2><p>根据当前语言的 FAQ 知识生成机器可读回答基线，保留引用和人工复核状态。</p></div>
            <div class="toolbar-actions">
              <span class="panel-count"><el-icon><Tickets /></el-icon>{{ geoSnapshots.length }} 条</span>
              <el-button v-if="canAudit" type="primary" plain :loading="geoLoading" @click="generateGeoSnapshots"><el-icon><DataAnalysis /></el-icon>生成快照</el-button>
            </div>
          </div>
          <el-table v-loading="geoLoading" :data="geoSnapshots" class="ops-table" table-layout="fixed">
            <el-table-column prop="question" label="问题" min-width="260" show-overflow-tooltip />
            <el-table-column label="平台 / 语言" width="180"><template #default="{ row }">{{ row.platform }} · {{ row.locale }}</template></el-table-column>
            <el-table-column label="准确性" width="110"><template #default="{ row }"><el-tag size="small" :type="accuracyStatusType(row.accuracyStatus || row.accuracy_status)" effect="light">{{ accuracyStatusText(row.accuracyStatus || row.accuracy_status) }}</el-tag></template></el-table-column>
            <el-table-column prop="answer" label="回答" min-width="340" show-overflow-tooltip />
            <el-table-column label="生成时间" width="170"><template #default="{ row }">{{ formatDate(row.checkedAt || row.checked_at || row.createdAt || row.created_at) }}</template></el-table-column>
          </el-table>
          <el-empty v-if="!geoLoading && !geoSnapshots.length" description="还没有 GEO 快照，可从 FAQ 生成一组基线问题" :image-size="72" />
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
            <el-form-item label="企业 Logo 地址"><el-input v-model="siteForm.logoUrl" placeholder="https://... 或站点内 /assets/..." /></el-form-item>
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
          <el-form-item v-if="editingType === 'product_locale'" label="产品主数据" required>
            <el-select v-model="editingForm.productId" filterable style="width:100%" placeholder="选择产品编号">
              <el-option v-for="product in contentCollections.products" :key="product.id" :label="product.productCode || product.product_code || product.slug" :value="product.id" />
            </el-select>
          </el-form-item>
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
          <el-form-item v-if="editingType === 'keyword'" label="优先级"><el-input-number v-model="editingForm.priority" :min="1" :max="100" controls-position="right" style="width:100%" /></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="档案类型"><el-select v-model="editingForm.profileType" style="width:100%"><el-option label="行业目录" value="directory" /><el-option label="协会" value="association" /><el-option label="合作伙伴" value="partner" /><el-option label="媒体" value="media" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="核验状态"><el-select v-model="editingForm.verificationStatus" style="width:100%"><el-option label="待核验" value="pending" /><el-option label="已核验" value="verified" /><el-option label="需复核" value="needs_review" /><el-option label="阻断" value="blocked" /></el-select></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="市场 / 语言"><el-input v-model="editingForm.market" placeholder="US · en-US" /></el-form-item>
          <el-form-item v-if="editingType === 'externalProfile'" label="负责人"><el-input v-model="editingForm.ownerId" placeholder="负责人账号" /></el-form-item>
        </div>

        <el-form-item v-if="hasTitleField" label="标题" required><el-input v-model="editingForm.title" placeholder="公开展示标题" /></el-form-item>
        <el-form-item v-if="editingType === 'product_locale'" label="产品名称" required><el-input v-model="editingForm.title" placeholder="当前语言的公开产品名称" /></el-form-item>
        <el-form-item v-if="editingType === 'evidence'" label="可验证声明" required><el-input v-model="editingForm.claim" type="textarea" :rows="3" placeholder="只能填写可被证据支持的事实" /></el-form-item>
        <el-form-item v-if="editingType === 'solution'" label="应用场景"><el-input v-model="editingForm.scenario" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'case'" label="项目范围"><el-input v-model="editingForm.scope" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'certificate' || editingType === 'download'" label="公开说明"><el-input v-model="editingForm.description" type="textarea" :rows="3" placeholder="说明公开范围和资料用途，不填写未经确认的商业承诺" /></el-form-item>
        <el-form-item v-if="editingType === 'page' || editingType === 'solution' || editingType === 'case'" label="摘要 / 说明"><el-input v-model="editingForm.summary" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'product_locale'" label="产品摘要"><el-input v-model="editingForm.summary" type="textarea" :rows="3" /></el-form-item>
        <el-form-item v-if="editingType === 'product_locale'" label="产品说明"><el-input v-model="editingForm.description" type="textarea" :rows="5" /></el-form-item>
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
        <div v-if="editingType === 'product_locale'" class="form-grid form-grid-two">
          <el-form-item label="图片地址 JSON"><el-input v-model="editingForm.imageUrlsText" type="textarea" :rows="5" placeholder='[]' /></el-form-item>
          <el-form-item label="SEO JSON"><el-input v-model="editingForm.seoText" type="textarea" :rows="5" placeholder='{"title":"","description":"","applications":[]}' /></el-form-item>
          <el-form-item label="产品 FAQ JSON"><el-input v-model="editingForm.faqText" type="textarea" :rows="5" placeholder='[]' /></el-form-item>
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
import { useCompanySiteOperations } from '@/composables/use-company-site-operations'

const {
  Box,
  COMPANY_SITE_MANAGE_ROLES,
  COMPANY_SITE_READ_ROLES,
  COMPANY_SITE_SCOPES,
  Collection,
  DataAnalysis,
  DataBoard,
  Document,
  DocumentChecked,
  Edit,
  ElMessage,
  ElMessageBox,
  MANAGE_ACTIONS,
  Plus,
  Promotion,
  READ_ACTIONS,
  Refresh,
  Setting,
  Tickets,
  TrendCharts,
  User,
  Warning,
  WarningFilled,
  accuracyStatusText,
  accuracyStatusType,
  activeContentRows,
  activeContentType,
  activeContentTypeInfo,
  activeContentTypeLabel,
  activeSection,
  advanceContentStatus,
  allContentRows,
  approveDraft,
  attentionItems,
  buildContentPayload,
  canAudit,
  canContentWrite,
  canManage,
  canPublish,
  canRead,
  canSalesApprove,
  canSalesPrecheck,
  canSalesWrite,
  canSiteWrite,
  computed,
  contentCollections,
  contentCount,
  contentLoading,
  contentMeta,
  contentTitle,
  contentTypes,
  correctionFilter,
  correctionStatusText,
  correctionStatusType,
  correctionTasks,
  correctionsLoading,
  customerMatch,
  customerMatchVisible,
  detailText,
  draftApprovalText,
  draftApprovalType,
  draftDetail,
  draftDetailVisible,
  draftFilter,
  draftLeadRef,
  draftTypeText,
  drafts,
  draftsLoading,
  editContent,
  editDialogVisible,
  editingForm,
  editingId,
  editingType,
  emptyContentForm,
  factLoading,
  factReport,
  factSummary,
  featureAvailability,
  formatDate,
  generateGeoSnapshots,
  geoLoading,
  geoSnapshots,
  getUserInfo,
  handleAuthUpdate,
  hasLocaleField,
  hasSlugField,
  hasTitleField,
  jsonText,
  keywordIntentText,
  keywordMapLoading,
  keywordMapReport,
  keywordTypeText,
  leadStatusText,
  leadStatusType,
  leads,
  leadsLoading,
  loadAll,
  loadContent,
  loadContentCatalog,
  loadCorrectionTasks,
  loadDrafts,
  loadError,
  loadFactGovernance,
  loadGeoSnapshots,
  loadKeywordMap,
  loadLeads,
  loadSeoChecks,
  loadSite,
  loading,
  newContent,
  newLeadCount,
  nextStatus,
  nextStatusLabel,
  onMounted,
  onUnmounted,
  openCueBuilder,
  openDraft,
  openFactoryDemo,
  operationSteps,
  parseJson,
  precheckDraft,
  publishSite,
  publishedContentCount,
  publishingSite,
  reactive,
  readRowValue,
  recentContentRows,
  ref,
  refreshAuthState,
  request,
  reviewGeoSnapshot,
  router,
  runCustomerMatch,
  runSeoCheck,
  saveContent,
  saveSite,
  savingContent,
  savingSite,
  scanFacts,
  seoChecks,
  seoLoading,
  seoOpenCount,
  seoSummary,
  severityTagType,
  severityText,
  site,
  siteForm,
  siteStatusText,
  siteStatusType,
  statusTagType,
  statusText,
  summaryCards,
  syncSiteForm,
  textValue,
  updateCorrectionStatus,
  useRouter,
} = useCompanySiteOperations()
</script>

<style scoped src="../styles/company-site-operations.css"></style>
