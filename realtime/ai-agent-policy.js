// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const normalizeAiText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  if (typeof value === 'object') {
    return String(value.text || '').trim();
  }
  return String(value).trim();
};

const normalizeStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractAiContentText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      if (typeof item === 'object') {
        return item.text || item.content || item.output_text || '';
      }
      return String(item);
    }).filter(Boolean).join('\n').trim();
  }
  if (typeof value === 'object') {
    return String(value.text || value.content || value.output_text || '').trim();
  }
  return String(value).trim();
};

const normalizeMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'worker' || mode === 'enterprise' || mode === 'workflow') return mode;
  return '';
};

const normalizeMessageContent = (content) => {
  if (typeof content === 'string') {
    return content.slice(0, 10000);
  }
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'text') {
      const text = normalizeAiText(item.text);
      if (text) parts.push({ type: 'text', text: text.slice(0, 10000) });
      continue;
    }
    if (item.type === 'image_url') {
      const url = normalizeAiText(item?.image_url?.url || item?.url);
      if (url) parts.push({ type: 'image_url', image_url: { url } });
    }
  }
  return parts.length > 0 ? parts : '';
};


const sanitizeConversationMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  const normalized = [];
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '').toLowerCase();
    // Force system prompt ownership to backend route layer.
    if (role !== 'user' && role !== 'assistant') continue;
    const content = normalizeMessageContent(item.content);
    if (!content || (Array.isArray(content) && content.length === 0)) continue;
    normalized.push({ role, content });
  }
  return normalized.slice(-24);
};

const extractLatestUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const content = message?.content;
    if (typeof content === 'string') {
      return normalizeAiText(content);
    }
    if (Array.isArray(content)) {
      const text = content
        .filter((part) => part?.type === 'text')
        .map((part) => normalizeAiText(part?.text))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) return text;
    }
  }
  return '';
};

const hasAnyKeyword = (text, patterns) => {
  if (!text) return false;
  return patterns.some((p) => p.test(text));
};

const WORKFLOW_INTENT_PATTERNS = [
  /流程|审批|节点|流转|编排|BPMN|workflow|流程图|发布流程|办理路径/i
];

const ENTERPRISE_INTENT_PATTERNS = [
  /经营|报表|收入|利润|毛利|同比|环比|趋势|分析|看板|图表|echarts|KPI|指标/i
];

const FORM_INTENT_PATTERNS = [
  /表单|模板|单据|表格模板|form[-_ ]?template|form/i
];

const MATERIALS_INTENT_PATTERNS = [
  /物料|库存|出入库|台账|分类|批次|仓库/i
];

const detectIntent = (latestUserText, context = {}) => {
  const text = normalizeAiText(latestUserText);
  const aiScene = String(context?.aiScene || '').toLowerCase();

  if (hasAnyKeyword(text, WORKFLOW_INTENT_PATTERNS) || aiScene.includes('workflow')) {
    return 'workflow';
  }
  if (hasAnyKeyword(text, FORM_INTENT_PATTERNS) || aiScene.includes('form')) {
    return 'form';
  }
  if (hasAnyKeyword(text, ENTERPRISE_INTENT_PATTERNS)) {
    return 'enterprise_report';
  }
  if (hasAnyKeyword(text, MATERIALS_INTENT_PATTERNS)) {
    return 'materials_ops';
  }
  return 'general';
};

const canUseWorkflowAgent = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin') return true;
  return (user?.permissions || []).some((perm) => String(perm).toLowerCase().includes('workflow'));
};

const resolveDefaultModeByRole = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role.includes('viewer') || role.includes('operator') || role.includes('worker')) {
    return 'worker';
  }
  return 'enterprise';
};

const AGENT_LABELS = {
  enterprise_analyst: '企业经营分析智能体',
  worker_assistant: '企业工作助手智能体',
  workflow_orchestrator: '流程编排智能体'
};

const AGENT_RUNTIME_DEFAULTS = {
  enterprise_analyst: {
    temperature: 0.2,
    top_p: 0.8,
    max_tokens: 4096,
    thinking: { type: 'enabled' },
    tools_whitelist: ['echarts']
  },
  worker_assistant: {
    temperature: 0.3,
    top_p: 0.9,
    max_tokens: 4096,
    thinking: { type: 'enabled' },
    tools_whitelist: ['form-template', 'translate', 'map-locate']
  },
  workflow_orchestrator: {
    temperature: 0.1,
    top_p: 0.7,
    max_tokens: 6144,
    thinking: { type: 'enabled' },
    tools_whitelist: ['workflow-meta', 'bpmn-xml', 'mermaid']
  }
};

const pickFirstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const normalizeFiniteNumber = (value, fallback, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (min !== undefined && num < min) return fallback;
  if (max !== undefined && num > max) return fallback;
  return num;
};

const getAgentConfigMap = (cfg) => {
  const value = cfg?.agents || cfg?.agent_profiles || {};
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
};

const normalizeToolsWhitelist = (value, fallback = []) => {
  const list = normalizeStringList(value ?? fallback)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(list));
};

const resolveAgentRuntimeConfig = (cfg, agentId) => {
  const defaults = AGENT_RUNTIME_DEFAULTS[agentId] || AGENT_RUNTIME_DEFAULTS.enterprise_analyst;
  const customMap = getAgentConfigMap(cfg);
  const custom = (customMap[agentId] && typeof customMap[agentId] === 'object') ? customMap[agentId] : {};
  const thinkingValue = pickFirstDefined(custom.thinking, cfg?.thinking, defaults.thinking);

  return {
    id: agentId,
    label: AGENT_LABELS[agentId] || agentId,
    model: normalizeAiText(
      pickFirstDefined(custom.model, cfg?.model, 'glm-4.6v')
    ) || 'glm-4.6v',
    temperature: normalizeFiniteNumber(
      pickFirstDefined(custom.temperature, defaults.temperature),
      defaults.temperature,
      0,
      2
    ),
    top_p: normalizeFiniteNumber(
      pickFirstDefined(custom.top_p, custom.topP, defaults.top_p),
      defaults.top_p,
      0,
      1
    ),
    max_tokens: normalizeFiniteNumber(
      pickFirstDefined(custom.max_tokens, custom.maxTokens, defaults.max_tokens),
      defaults.max_tokens,
      1,
      65535
    ),
    thinking: (thinkingValue && typeof thinkingValue === 'object')
      ? thinkingValue
      : defaults.thinking,
    tools_whitelist: normalizeToolsWhitelist(
      pickFirstDefined(custom.tools_whitelist, custom.tool_whitelist, custom.allowed_tools, custom.toolWhitelist),
      defaults.tools_whitelist
    )
  };
};

const buildAgentCatalog = (user, cfg) => {
  const ids = ['enterprise_analyst', 'worker_assistant', 'workflow_orchestrator'];
  return ids.map((id) => {
    const runtime = resolveAgentRuntimeConfig(cfg, id);
    const enabled = id === 'workflow_orchestrator' ? canUseWorkflowAgent(user) : true;
    return {
      id,
      label: runtime.label,
      enabled,
      model: runtime.model,
      temperature: runtime.temperature,
      top_p: runtime.top_p,
      max_tokens: runtime.max_tokens,
      tools_whitelist: runtime.tools_whitelist
    };
  });
};

const compactColumnsForPrompt = (columns, limit = 60) => {
  if (!Array.isArray(columns)) return [];
  return columns.slice(0, limit).map((col) => ({
    label: col?.label || col?.prop || '',
    prop: col?.prop || '',
    type: col?.type || 'text',
    expression: col?.expression || ''
  }));
};

const compactAiContextForPrompt = (context) => {
  if (!context || typeof context !== 'object') return null;
  const compact = {};
  [
    'app',
    'view',
    'viewId',
    'apiUrl',
    'profile',
    'currentUser',
    'dataScope',
    'searchText',
    'aiScene',
    'allowImport',
    'allowFormula',
    'allowFormulaOnce'
  ].forEach((key) => {
    if (context[key] !== undefined) compact[key] = context[key];
  });
  if (context.gridAgent && typeof context.gridAgent === 'object') compact.gridAgent = context.gridAgent;
  if (context.gridAgentServerResult && typeof context.gridAgentServerResult === 'object') {
    compact.gridAgentServerResult = context.gridAgentServerResult;
  }
  if (context.dataStats && typeof context.dataStats === 'object') compact.dataStats = context.dataStats;
  if (Array.isArray(context.columns)) compact.columns = compactColumnsForPrompt(context.columns, 80);
  if (Array.isArray(context.dataSample)) compact.dataSample = context.dataSample.slice(0, 12);
  if (context.summaryConfig && typeof context.summaryConfig === 'object') compact.summaryConfig = context.summaryConfig;
  if (context.smartBi && typeof context.smartBi === 'object') compact.smartBi = context.smartBi;
  if (Array.isArray(context.fileColumns) && context.fileColumns.length) {
    compact.fileColumns = compactColumnsForPrompt(context.fileColumns, 20);
  }
  if (context.importTarget && typeof context.importTarget === 'object') compact.importTarget = context.importTarget;
  [
    'importRequiredFields',
    'importDefaults',
    'importGeneratedFields',
    'importTips',
    'materialsCategories',
    'materialsCategoryDepth'
  ].forEach((key) => {
    if (context[key] !== undefined) compact[key] = context[key];
  });
  return compact;
};

const SMART_BI_DOMAINS = [
  {
    key: 'sales',
    label: '销售',
    aliases: ['销售', '客户', '订单', '回款', '应收', '商机', '成交', '发货', '收入', '业绩'],
    metrics: ['销售额/订单金额', '订单数量与状态', '客户数量与分层', '商机金额与阶段', '回款金额与应收余额', '交付延期与跟进风险']
  },
  {
    key: 'purchase',
    label: '采购',
    aliases: ['采购', '供应商', '到货', '采购订单', '采购需求', '来料', 'iqc', '供应', '交期'],
    metrics: ['采购金额', '采购需求状态', '采购订单履约', '到货达成', 'IQC 检验状态', '供应商交期风险']
  },
  {
    key: 'inventory',
    label: '库存',
    aliases: ['库存', '仓库', '物料', '批次', '低库存', '呆滞', '效期', '出入库', '盘点', '库位'],
    metrics: ['实时库存数量', '物料数量与分类', '仓库库存分布', '近期出入库', '盘点差异', '低库存/效期/呆滞风险']
  },
  {
    key: 'production',
    label: '生产',
    aliases: ['生产', '工单', '排产', '齐套', '缺料', '领料', '完工', '产能', '计划', 'bom'],
    metrics: ['生产工单数量', '计划生产数量', '工单状态', '齐套率/缺料项', '领料状态', '计划完工风险']
  },
  {
    key: 'quality',
    label: '质量',
    aliases: ['质量', '质检', '检验', '不良', '合格率', '不合格', '整改', '异常', '审核', 'ncr'],
    metrics: ['检验批次数', '合格率/不良率', '质量异常数量与等级', '整改闭环状态', '审核发现项', '待判定/待整改/待验证风险']
  },
  {
    key: 'equipment',
    label: '设备',
    aliases: ['设备', '点检', '巡检', '保养', '维保', '维修', '故障', '停机', '健康', '稼动'],
    metrics: ['设备总数与运行状态', '设备健康评分', '点检异常', '故障/异常数量', '维保工单与停机时长', '保养计划达成']
  }
];

const SMART_BI_METRIC_DEFINITIONS = {
  sales: [
    { label: '销售额', formula: '销售订单 total_amount 汇总', chart: '按订单日期生成销售趋势柱线图', riskRule: '订单金额下降或交付延期增加时预警', owner: '销售负责人' },
    { label: '应收余额', formula: '客户 receivable_balance 汇总', chart: '按客户生成应收风险排行', riskRule: '应收余额超过授信额度或持续上升时预警', owner: '销售/财务负责人' },
    { label: '商机金额', formula: '销售商机 expected_amount 汇总，并按 stage 分组', chart: '生成商机阶段漏斗', riskRule: '高金额商机长期停留在早期阶段时预警', owner: '销售负责人' }
  ],
  purchase: [
    { label: '采购金额', formula: '采购订单 total_amount 汇总', chart: '按订单日期生成采购金额趋势', riskRule: '采购金额异常放大或集中于单一供应商时预警', owner: '采购负责人' },
    { label: '到货合格率', formula: 'accepted_quantity / arrival_quantity * 100%', chart: '生成到货数量与合格数量对比图', riskRule: '到货合格率低于 95% 时预警', owner: '采购/IQC 负责人' },
    { label: '待跟到货', formula: '采购订单中未到货、未关闭、未取消的订单数量', chart: '按供应商或预计到货日生成待跟排行', riskRule: '预计到货日临近或逾期仍未到货时预警', owner: '采购负责人' }
  ],
  inventory: [
    { label: '实时库存数量', formula: '库存视图 available_qty 汇总', chart: '按仓库生成库存分布柱状图', riskRule: '库存过高占用或库存不足时预警', owner: '仓储负责人' },
    { label: '物料数', formula: '按 material_code 去重统计', chart: '按物料分类生成结构占比图', riskRule: '关键物料缺失或分类异常集中时预警', owner: '仓储/计划负责人' },
    { label: '盘点差异', formula: '盘点单 diff_count 与状态汇总', chart: '生成盘点状态分布和差异排行', riskRule: '盘亏盘盈差异持续出现时预警', owner: '仓储负责人' }
  ],
  production: [
    { label: '计划生产数量', formula: '生产工单 planned_qty 汇总', chart: '按产品生成计划数量排行', riskRule: '计划集中但缺料项较多时预警', owner: '生产计划负责人' },
    { label: '工单状态', formula: '按 work_order_status 汇总工单数量', chart: '生成工单状态分布图', riskRule: '待排产/生产中积压过多时预警', owner: '生产负责人' },
    { label: '缺料工单', formula: 'shortage_item_count > 0 的工单数量', chart: '生成缺料工单排行', riskRule: '缺料工单数大于 0 且临近计划完工日时预警', owner: '计划/仓储负责人' }
  ],
  quality: [
    { label: '检验合格率', formula: '合格或让步接收检验批次 / 检验总批次 * 100%', chart: '生成检验结果分布图', riskRule: '合格率低于 98% 时预警', owner: '质量负责人' },
    { label: '不良率', formula: 'defect_qty / sample_qty * 100%', chart: '生成不良率趋势或物料排行', riskRule: '不良率超过 2% 时预警', owner: '质量负责人' },
    { label: '未关闭异常', formula: '质量异常中 ncr_status 不等于已关闭的数量', chart: '按严重等级生成异常分布图', riskRule: '严重/关键异常未闭环时预警', owner: '质量/责任部门负责人' }
  ],
  equipment: [
    { label: '设备健康评分', formula: '设备台账 health_score 平均值', chart: '生成设备健康评分排行', riskRule: '平均评分低于 80 或关键设备低于 80 时预警', owner: '设备负责人' },
    { label: '未关闭设备异常', formula: '设备异常中 issue_status 不等于已关闭的数量', chart: '按异常等级生成分布图', riskRule: '紧急异常未关闭或停机设备存在时预警', owner: '设备负责人' },
    { label: '停机时长', formula: '维保工单 downtime_hours 汇总', chart: '按设备生成停机时长排行', riskRule: '停机时长持续增加时预警', owner: '设备/生产负责人' }
  ]
};

const getSmartBiMetricDefinitions = (domainKey = 'overview') => {
  if (domainKey && domainKey !== 'overview') return SMART_BI_METRIC_DEFINITIONS[domainKey] || [];
  return SMART_BI_DOMAINS.flatMap((domain) => SMART_BI_METRIC_DEFINITIONS[domain.key] || []);
};

const resolveSmartBiQuestionRoute = (text = '') => {
  const normalized = String(text || '').toLowerCase();
  const scored = SMART_BI_DOMAINS.map((domain) => {
    const matchedKeywords = domain.aliases.filter((keyword) => normalized.includes(String(keyword).toLowerCase()));
    return { key: domain.key, label: domain.label, score: matchedKeywords.length, matchedKeywords };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) return { key: 'overview', label: '经营总览', confidence: 'low', matchedKeywords: [] };
  return {
    key: top.key,
    label: top.label,
    confidence: top.score >= 2 ? 'high' : 'medium',
    matchedKeywords: top.matchedKeywords
  };
};

const buildSmartBiPromptBlock = (smartBi, latestUserText = '') => {
  const route = smartBi?.route && typeof smartBi.route === 'object'
    ? smartBi.route
    : resolveSmartBiQuestionRoute(latestUserText);
  const catalog = Array.isArray(smartBi?.metricCatalog) && smartBi.metricCatalog.length
    ? smartBi.metricCatalog
    : (route.key === 'overview' ? SMART_BI_DOMAINS : SMART_BI_DOMAINS.filter((domain) => domain.key === route.key));
  const metricDefinitions = Array.isArray(smartBi?.metricDefinitions) && smartBi.metricDefinitions.length
    ? smartBi.metricDefinitions
    : getSmartBiMetricDefinitions(route.key);
  const catalogLines = catalog.map((domain) => `- ${domain.label}：${domain.metrics.join('、')}`).join('\n');
  const metricLines = metricDefinitions.map((item) => `- ${item.label}：口径=${item.formula}；默认图表=${item.chart}；风险阈值=${item.riskRule}；负责方向=${item.owner}`).join('\n');
  const selectedCard = smartBi?.selectedCard && typeof smartBi.selectedCard === 'object'
    ? smartBi.selectedCard
    : null;
  const selectedCardBlock = selectedCard
    ? `\n\n【当前智能 BI 指标卡】\n- 卡片：${selectedCard.label || route.label || '经营总览'}\n- 业务说明：${selectedCard.desc || ''}\n- 主指标：${selectedCard.metricLabel || '核心指标'} = ${selectedCard.metricValue || '--'}\n- 辅助指标：${selectedCard.subLabel || '辅助指标'} = ${selectedCard.subValue || '--'}\n- 风险指标：${selectedCard.riskLabel || '风险指标'} = ${selectedCard.riskValue || '--'}\n- 风险状态：${selectedCard.riskStatusLabel || '--'}（${selectedCard.riskLevel || 'auto'}）\n- 风险原因：${selectedCard.riskReason || '暂无'}\n- 指标口径：${selectedCard.metricDefinition || '按系统当前业务快照统计'}\n- 默认图表：${selectedCard.chartTemplate || '按业务场景生成结构/趋势图'}\n- 负责方向：${selectedCard.owner || '业务负责人'}`
    : '';
  const snapshotExcerpt = typeof smartBi?.snapshotExcerpt === 'string' && smartBi.snapshotExcerpt.trim()
    ? smartBi.snapshotExcerpt.trim()
    : '';
  const snapshotExcerptBlock = snapshotExcerpt
    ? `\n\n【当前前端快照摘要】\n${snapshotExcerpt.slice(0, 5000)}`
    : '';
  const reportModeLine = smartBi?.reportMode === 'workbench_card'
    ? '\n当前请求来自智能 BI 工作台指标卡点击。请按标准 BI 报告输出，不要只回答一句话。'
    : smartBi?.reportMode === 'manual_question'
      ? '\n当前请求来自用户自然语言提问。请按当前问题路由自动选择指标，并输出标准 BI 报告。'
      : smartBi?.reportMode === 'metric_catalog'
        ? '\n当前请求来自智能 BI 指标目录。请围绕当前领域的固定指标、口径、图表和风险阈值输出标准 BI 报告。'
        : smartBi?.reportMode === 'common_question'
          ? '\n当前请求来自智能 BI 常用问题入口。请按预设问题路由输出标准 BI 报告。'
          : '';
  return `\n\n【智能 BI 指标目录与问题路由】\n当前问题路由：${route.label || '经营总览'}（${route.key || 'overview'}，置信度：${route.confidence || 'auto'}）。${route.matchedKeywords?.length ? `命中关键词：${route.matchedKeywords.join('、')}。` : ''}${reportModeLine}\n内置指标目录：\n${catalogLines}${selectedCardBlock}${snapshotExcerptBlock}\n\n【固定指标口径/图表模板/风险阈值】\n${metricLines}\n标准输出模板：每次回答必须稳定包含“关键指标、指标图表、风险提醒、行动建议”。关键指标要说明口径和值；指标图表优先按默认图表模板输出 ECharts JSON；风险要按阈值和业务影响分级并指出影响对象；建议要包含负责方向、时间节点和目标。`;
};

const buildGridAgentRuleBlock = (context) => {
  const gridAgent = context?.gridAgent;
  if (!gridAgent || typeof gridAgent !== 'object') return '';
  const access = gridAgent.dataAccess || {};
  const capabilities = gridAgent.capabilities || {};
  const serverResult = context?.gridAgentServerResult;
  const tools = Array.isArray(gridAgent.serverTools)
    ? gridAgent.serverTools.map((tool) => tool?.name).filter(Boolean).join('、')
    : '';
  const serverResultLine = serverResult && typeof serverResult === 'object'
    ? `\n5. 当前上下文已包含 gridAgentServerResult，它来自服务端受控只读查询，scope=server；回答全量数量、分布、汇总时优先使用该结果。`
    : '';
  return `\n\n【EISGrid 表格/Agent 对接规则】\n1. 当前表格上下文包含 gridAgent，说明这是 EISGrid v2 表格场景。\n2. 当用户问数量、条数、人数、统计、分布或汇总时，若 gridAgentServerResult.scope=server 且 totalCount 是数字，必须优先使用该服务端结果回答全量数量。\n3. 如果没有 gridAgentServerResult，dataSample 只是前端样本；dataStats.scope=loaded_rows 或 totalCountIsFull=false 时，只能回答“当前已加载 ${access.loadedCount ?? 0} 行”，不能说成数据库全量。\n4. 如果 access.hasMore=true，说明表格还有更多分页数据未加载；涉及百万行、全表数量、全表汇总、分布统计时，必须说明需要服务端汇总/受控后端工具，不能根据样本编造。\n5. 当前服务端能力：serverAgentQuery=${capabilities.serverAgentQuery === true ? '可用' : '不可用'}，serverSummary=${capabilities.serverSummary === true ? '可用' : '不可用'}，serverFormulaRecalculate=${capabilities.serverFormulaRecalculate === true ? '可用' : '不可用'}${tools ? `，工具：${tools}` : ''}。${serverResultLine}\n6. 生成公式时只能引用 columns/gridAgent.searchableColumns 中存在的字段；不要生成任意 SQL，不要要求用户把百万行导入浏览器。`;
};

const buildAgentSystemPrompt = ({ agentId, context, user, intent, latestUserText }) => {
  const snapshot = context?.businessSnapshot;
  const semanticCtx = context?.semanticContext;
  const hasImportTarget = !!(context?.importTarget && typeof context.importTarget === 'object' && context.importTarget.apiUrl);
  const ctxCopy = context ? { ...context } : {};
  delete ctxCopy.businessSnapshot;
  delete ctxCopy.injectBusinessData;
  delete ctxCopy.semanticContext;

  const promptContext = compactAiContextForPrompt(ctxCopy);
  const safeContext = promptContext && typeof promptContext === 'object' && Object.keys(promptContext).length
    ? JSON.stringify(promptContext, null, 2).slice(0, 9000)
    : '';

  const contextBlock = safeContext
    ? `\n\n【业务上下文】\n${safeContext}`
    : '';
  const gridAgentRuleBlock = buildGridAgentRuleBlock(context);
  const smartBiBlock = agentId === 'enterprise_analyst'
    ? buildSmartBiPromptBlock(context?.smartBi, latestUserText)
    : '';

  const snapshotBlock = snapshot && typeof snapshot === 'object'
    ? `\n\n【企业实时数据快照（${snapshot.snapshotTime || '最新'}）】\n以下是从系统数据库查询到的真实业务数据，请基于这些真实数据进行分析，不要编造数据：\n${JSON.stringify(snapshot, null, 2).slice(0, 16000)}`
    : '';

  // ── 构建语义上下文块（所有 agent 通用） ──
  let semanticBlock = '';
  if (semanticCtx && typeof semanticCtx === 'object') {
    const parts = [];
    parts.push('以下是系统本体语义模型，描述了数据库表、列和关系的业务含义，请利用这些语义信息更准确地理解和分析数据：');

    // 表级语义
    if (Array.isArray(semanticCtx.tables) && semanticCtx.tables.length) {
      const tableLines = semanticCtx.tables.map(t =>
        `  - ${t.schema}.${t.table}（${t.name}）${t.desc ? '：' + t.desc : ''}`
      );
      parts.push(`\n数据表清单（${semanticCtx.tables.length}张）：\n${tableLines.join('\n')}`);
    }

    // 列级语义（按表分组，每表最多显示关键列）
    if (semanticCtx.columns && typeof semanticCtx.columns === 'object') {
      const tableKeys = Object.keys(semanticCtx.columns);
      const colLines = [];
      for (const tbl of tableKeys) {
        const cols = semanticCtx.columns[tbl];
        if (!Array.isArray(cols) || !cols.length) continue;
        const colDesc = cols.slice(0, 15).map(c =>
          `${c.col}=${c.name}${c.cls ? '(' + c.cls + ')' : ''}`
        ).join(', ');
        colLines.push(`  ${tbl}: ${colDesc}${cols.length > 15 ? ` ...共${cols.length}列` : ''}`);
      }
      if (colLines.length) {
        parts.push(`\n列级语义（${tableKeys.length}张表）：\n${colLines.join('\n')}`);
      }
    }

    // 表间关系
    if (Array.isArray(semanticCtx.relations) && semanticCtx.relations.length) {
      const relLines = semanticCtx.relations.map(r =>
        `  - ${r.from}（${r.fromName || ''}）--[${r.predicate}]--> ${r.to}（${r.toName || ''}）`
      );
      parts.push(`\n表间关系（${semanticCtx.relations.length}条）：\n${relLines.join('\n')}`);
    }

    // 权限语义
    if (Array.isArray(semanticCtx.permissions) && semanticCtx.permissions.length) {
      const permLines = semanticCtx.permissions.slice(0, 30).map(p =>
        `  - ${p.code}（${p.kind}${p.entity ? '/' + p.entity : ''}${p.action ? '.' + p.action : ''}）`
      );
      parts.push(`\n权限语义（前${Math.min(30, semanticCtx.permissions.length)}条）：\n${permLines.join('\n')}`);
    }

    const rawSemanticText = parts.join('\n');
    semanticBlock = `\n\n【系统本体语义模型（${semanticCtx.fetchedAt || '最新'}）】\n${rawSemanticText.slice(0, 6000)}`;
  }

  if (agentId === 'workflow_orchestrator') {
    return `你是流程编排智能体。你的职责是把业务需求转换成可落地的流程定义。\n\n【硬性规则】\n1. 必须输出 Mermaid 流程图（\`\`\`mermaid）。\n2. 必须输出 BPMN XML（\`\`\`bpmn-xml）。\n3. 必须输出流程元信息（\`\`\`workflow-meta），包含 name、associated_table、workflowBusinessAppId、task_assignments、state_mappings。\n4. workflow-meta 必须是严格 JSON；BPMN userTask 的 id 必须与 task_assignments.task_id、state_mappings.bpmn_task_id 完全一致。\n5. 常用业务绑定：入职/员工档案用 associated_table=hr.archives 且 workflowBusinessAppId=legacy:hr_employee；出入库草稿用 associated_table=scm.inventory_drafts；物料台账用 public.raw_materials。\n6. 禁止输出经营分析图表（如 ECharts）和无关内容。\n7. 语气简洁，优先可执行结果。\n8. 利用【系统本体语义模型】中的表结构和关系来选择正确的 associated_table、任务分派和状态映射。\n\nworkflow-meta 示例：\n\`\`\`workflow-meta\n{\n  \"name\": \"入职流程\",\n  \"description\": \"员工入职审批与账号开通\",\n  \"associated_table\": \"hr.archives\",\n  \"workflowBusinessAppId\": \"legacy:hr_employee\",\n  \"task_assignments\": [\n    { \"task_id\": \"Task_Submit\", \"candidate_roles\": [\"employee\", \"hr_clerk\"], \"candidate_users\": [], \"approval_mode\": \"any\", \"required_approvals\": 1, \"require_comment\": false }\n  ],\n  \"state_mappings\": [\n    { \"bpmn_task_id\": \"Task_Submit\", \"target_table\": \"hr.archives\", \"state_field\": \"status\", \"state_value\": \"待HR初审\" }\n  ]\n}\n\`\`\`\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${semanticBlock}${gridAgentRuleBlock}${contextBlock}`;
  }

  if (agentId === 'enterprise_analyst') {
    return `你是企业经营分析智能体。你的职责是输出“专业但通俗易懂”的经营分析报告，并给出可执行建议。\n\n【表达风格】\n1. 用业务语言解释指标含义，尽量少术语；若必须用术语，紧跟一句白话解释。\n2. 先给一句结论，再给证据（数据/图表），最后给行动建议。\n3. 每条建议都要可落地（负责人/时点/目标方向）。\n\n【硬性规则】\n1. 回答开头禁止客套语（如“好的/收到/我将”），直接进入“经营分析报告”或“摘要”。\n2. 默认输出结构：摘要 -> 关键指标 -> 指标图表 -> 风险提醒 -> 行动建议。\n3. 图文并茂：当有数据时，优先给 2-4 个图（趋势、结构、对比、排行）。\n4. 输出 ECharts 时只允许 \`\`\`echarts 代码块，且必须是严格 JSON：双引号、无注释、无尾逗号、禁止函数（如 formatter/itemStyle.color function）。\n5. 严禁输出 BPMN XML、workflow-meta、流程编排内容，除非用户明确要求“流程编排/BPMN审批流设计”。\n6. 结论必须业务可执行，避免空话。\n7. 当系统提供了【企业实时数据快照】时，必须基于真实数据进行分析和图表生成，禁止编造或使用示例假数据。\n8. 利用【系统本体语义模型】理解数据表和字段的业务含义，用语义名称（中文）而非数据库原始字段名来呈现分析结果。\n9. 用户问题很短时必须自动按智能 BI 路由选择指标，例如“销售怎么样”走销售指标，“库存风险”走库存指标。\n10. 当行动建议中存在需要负责人跟进的事项时，必须在回答末尾追加 \`\`\`smart-bi-actions 代码块，内容是严格 JSON，最多 3 条，字段使用：title、domain、risk_level、owner_role、owner_name、due_days、reason、target、next_step、business_table、business_key。domain 只能用 overview/sales/purchase/inventory/production/quality/equipment；risk_level 只能用 normal/focus/warning/critical。不确定的 business_table/business_key 留空字符串。\n\nsmart-bi-actions 示例：\n\`\`\`smart-bi-actions\n{\n  \"actions\": [\n    {\n      \"title\": \"跟进库存占用风险\",\n      \"domain\": \"inventory\",\n      \"risk_level\": \"warning\",\n      \"owner_role\": \"warehouse_keeper\",\n      \"owner_name\": \"仓储负责人\",\n      \"due_days\": 3,\n      \"reason\": \"库存占用偏高，需要确认可用库存与呆滞物料\",\n      \"target\": \"降低库存占用并形成处理清单\",\n      \"next_step\": \"核对库存Top物料，给出处理计划\",\n      \"business_table\": \"\",\n      \"business_key\": \"\"\n    }\n  ]\n}\n\`\`\`\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${smartBiBlock}${semanticBlock}${snapshotBlock}${gridAgentRuleBlock}${contextBlock}`;
  }

  const importRuleBlock = hasImportTarget
    ? `\n【表格导入硬性规则】\n1. 当用户上传 Excel/CSV/表格，并要求录入、导入、填入当前表格、整理为系统数据时，必须输出 \`\`\`data-import 代码块。\n2. data-import 必须是严格 JSON，格式只能是：\n\`\`\`data-import\n{\n  "rows": [\n    { "name": "张三", "employee_no": "EMP001", "department": "生产部", "position": "操作员", "status": "试用" }\n  ]\n}\n\`\`\`\n3. 字段名优先使用【业务上下文】columns 中的 prop；可以根据列 label 映射，但最终 JSON key 尽量用 prop。\n4. 不要说“不支持导入”；当前页面已经提供导入上下文，前端会识别 data-import 并显示“导入到当前表格”按钮。\n5. 不要直接编造未在文件或用户文本中出现的员工数据；空白行不要输出。`
    : `\n【表格导入规则】\n当前没有可导入的表格上下文。若用户要求导入，请提示先进入目标表格页面再打开工作助手。`;

  return `你是企业一线工作助手。你的职责是帮助用户整理数据、填表、导入、解释字段。\n\n【硬性规则】\n1. 用通俗语句分步骤回答。\n2. 默认不输出流程编排内容（BPMN/workflow-meta），除非用户明确提出流程编排需求。\n3. 当用户要求表单模板时，输出 form-template 代码块。\n4. 关注可直接录入系统的字段结果。\n5. 利用【系统本体语义模型】中的列语义信息帮助用户理解字段含义、正确填写表单。${importRuleBlock}\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${semanticBlock}${gridAgentRuleBlock}${contextBlock}`;
};

const resolveAgentRoute = ({ user, body, messages }) => {
  const requestedMode = normalizeMode(body?.assistant_mode || body?.assistantMode || body?.mode);
  const context = (body?.context && typeof body.context === 'object') ? body.context : {};
  const latestUserText = extractLatestUserText(messages);
  const intent = detectIntent(latestUserText, context);
  const fallbackMode = resolveDefaultModeByRole(user);
  const mode = requestedMode || fallbackMode;
  const isSmartBiRequest = !!(context?.smartBi && typeof context.smartBi === 'object');
  const needsBusinessData = context?.injectBusinessData === true || isSmartBiRequest;

  let agentId = mode === 'worker' ? 'worker_assistant' : 'enterprise_analyst';
  if (isSmartBiRequest || needsBusinessData) {
    agentId = 'enterprise_analyst';
  } else if (intent === 'workflow') {
    agentId = canUseWorkflowAgent(user) ? 'workflow_orchestrator' : agentId;
  } else if (mode === 'workflow') {
    agentId = canUseWorkflowAgent(user) ? 'workflow_orchestrator' : 'enterprise_analyst';
  } else if (mode === 'enterprise') {
    agentId = 'enterprise_analyst';
  } else if (mode === 'worker') {
    agentId = 'worker_assistant';
  }

  return {
    requestedMode: mode,
    intent,
    agentId,
    context,
    latestUserText
  };
};

const composeAgentMessages = ({ route, user, messages }) => {
  const systemPrompt = buildAgentSystemPrompt({
    agentId: route.agentId,
    context: route.context,
    user,
    intent: route.intent,
    latestUserText: route.latestUserText
  });
  return [{ role: 'system', content: systemPrompt }, ...messages];
};

const extractCompletionText = (data) => {
  const choice = data?.choices?.[0] || {};
  const candidates = [
    choice?.message?.content,
    choice?.message?.text,
    choice?.delta?.content,
    data?.output_text,
    data?.text,
    data?.content
  ];
  for (const candidate of candidates) {
    const text = extractAiContentText(candidate);
    if (text) return text;
  }
  return '';
};

const extractStreamDeltaText = (data) => {
  const choice = data?.choices?.[0] || {};
  const candidates = [
    choice?.delta?.content,
    choice?.message?.content,
    data?.delta?.content,
    data?.output_text,
    data?.text,
    data?.content
  ];
  for (const candidate of candidates) {
    const text = extractAiContentText(candidate);
    if (text) return text;
  }
  return '';
};

const cleanModelText = (text) => {
  const trimmed = normalizeAiText(text);
  if (!trimmed) return '';
  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^["“]|["”]$/g, '')
    .trim();
};


module.exports = {
  buildAgentCatalog,
  buildAgentSystemPrompt,
  buildGridAgentRuleBlock,
  buildSmartBiPromptBlock,
  cleanModelText,
  compactAiContextForPrompt,
  composeAgentMessages,
  detectIntent,
  extractAiContentText,
  extractCompletionText,
  extractLatestUserText,
  extractStreamDeltaText,
  getSmartBiMetricDefinitions,
  normalizeAiText,
  normalizeMessageContent,
  normalizeToolsWhitelist,
  resolveAgentRoute,
  resolveAgentRuntimeConfig,
  resolveSmartBiQuestionRoute,
  sanitizeConversationMessages
};
