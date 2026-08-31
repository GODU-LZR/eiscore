// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const WORKFLOW_LEAK_PATTERNS = [
  /```[\t ]*bpmn-xml/i,
  /```[\t ]*workflow-meta/i,
  /```[\t ]*mermaid/i,
  /<bpmn[\s:>]/i,
  /\bworkflow-meta\b/i
];
const ENTERPRISE_FILLER_LINE_RE = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|先给出|先汇总|请查看|这里是).{0,100}(经营分析|经营报告|分析报告|报告|图表|洞察|结论)/;
const ENTERPRISE_FILLER_SENTENCE_RE = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,90}(经营分析|经营报告|分析报告|报告)/g;
const ECHARTS_FENCE_RE_GLOBAL = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/gi;
const ECHARTS_FENCE_RE_SINGLE = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/i;

const createAiOutputGuard = ({
  normalizeText,
  callAiUpstreamWithRetry,
  cleanModelText,
  extractCompletionText
}) => {
  const shouldApplyEnterpriseOutputGuard = (route) => {
    return route?.agentId === 'enterprise_analyst' && route?.intent !== 'workflow';
  };

  const containsWorkflowLeak = (text) => {
    const value = normalizeText(text);
    if (!value) return false;
    return WORKFLOW_LEAK_PATTERNS.some((pattern) => pattern.test(value));
  };

  const replaceCompletionText = (data, text) => {
    const safeText = normalizeText(text);
    if (!safeText) return data || {};
    const cloned = (data && typeof data === 'object')
      ? JSON.parse(JSON.stringify(data))
      : {};
    if (!Array.isArray(cloned.choices) || cloned.choices.length === 0) {
      cloned.choices = [{ index: 0, message: { role: 'assistant', content: safeText }, finish_reason: 'stop' }];
      return cloned;
    }
    const first = cloned.choices[0] || {};
    if (first.message && typeof first.message === 'object') {
      first.message.content = safeText;
    } else if (first.delta && typeof first.delta === 'object') {
      first.delta.content = safeText;
    } else {
      first.message = { role: 'assistant', content: safeText };
    }
    cloned.choices[0] = first;
    return cloned;
  };

  const stripEnterprisePreambleText = (rawText) => {
    const source = normalizeText(rawText);
    if (!source) return '';

    const lines = source.split(/\r?\n/);
    const cleaned = [];
    let removedLineCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        cleaned.push(line);
        continue;
      }
      if (
        removedLineCount < 5 &&
        ENTERPRISE_FILLER_LINE_RE.test(trimmed) &&
        trimmed.length <= 180 &&
        !trimmed.startsWith('```')
      ) {
        removedLineCount += 1;
        continue;
      }
      cleaned.push(line.replace(ENTERPRISE_FILLER_SENTENCE_RE, '').trimEnd());
    }

    return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const sanitizeJsonLikeText = (raw) => {
    if (!raw) return '';
    let cleaned = String(raw).trim();
    cleaned = cleaned.replace(/^\uFEFF/, '');
    cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    cleaned = cleaned.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
    cleaned = cleaned.replace(/^\s*[^={[]*=\s*/, '');

    const firstBrace = cleaned.search(/[{[]/);
    if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
    const lastCurly = cleaned.lastIndexOf('}');
    const lastSquare = cleaned.lastIndexOf(']');
    const lastBrace = Math.max(lastCurly, lastSquare);
    if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);
    return cleaned.trim();
  };

  const parseJsonSafe = (raw) => {
    const text = sanitizeJsonLikeText(raw);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      try {
        return JSON.parse(text.replace(/'/g, '"'));
      } catch {
        return null;
      }
    }
  };

  const stripFunctionValueBlocks = (input) => {
    const text = String(input || '');
    if (!text.includes(': function')) return text;
    let out = '';
    let cursor = 0;
    while (cursor < text.length) {
      const fnToken = text.indexOf(': function', cursor);
      if (fnToken < 0) {
        out += text.slice(cursor);
        break;
      }

      out += text.slice(cursor, fnToken) + ': null';
      let i = fnToken + 1;
      const keyword = text.indexOf('function', i);
      if (keyword < 0) {
        cursor = fnToken + 1;
        continue;
      }
      i = keyword + 'function'.length;
      while (i < text.length && text[i] !== '{') i += 1;
      if (i >= text.length) {
        cursor = text.length;
        break;
      }

      let depth = 0;
      let inString = false;
      let escaped = false;
      for (; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
      cursor = i;
    }
    return out;
  };

  const normalizeEchartsOption = (option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
    const cloned = JSON.parse(JSON.stringify(option));

    if (cloned.series && !Array.isArray(cloned.series)) {
      cloned.series = [cloned.series];
    }
    if (!Array.isArray(cloned.series)) return null;
    cloned.series = cloned.series.filter((item) => item && typeof item === 'object');
    if (cloned.series.length === 0) return null;

    cloned.series = cloned.series.map((series) => {
      const next = { ...series };
      if (!normalizeText(next.type)) next.type = 'line';
      return next;
    });

    const needsAxis = cloned.series.some((series) => {
      const type = String(series.type || '').toLowerCase();
      return ['line', 'bar', 'scatter'].includes(type);
    });
    if (needsAxis) {
      if (!cloned.xAxis) cloned.xAxis = { type: 'category', data: [] };
      if (!cloned.yAxis) cloned.yAxis = { type: 'value' };
    }
    if (!cloned.tooltip) {
      cloned.tooltip = { trigger: needsAxis ? 'axis' : 'item' };
    }

    return cloned;
  };

  const validateEchartsOption = (option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return false;
    if (!Array.isArray(option.series) || option.series.length === 0) return false;
    return option.series.every((series) => {
      if (!series || typeof series !== 'object') return false;
      return !!normalizeText(series.type);
    });
  };

  const buildFallbackEchartsOption = () => ({
    animation: false,
    grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
    xAxis: { type: 'category', show: false, data: [''] },
    yAxis: { type: 'value', show: false },
    tooltip: { show: false },
    series: [{
      name: '',
      type: 'line',
      data: [0],
      showSymbol: false,
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      areaStyle: { opacity: 0 }
    }]
  });

  const extractEchartsBlocks = (text) => {
    const source = normalizeText(text);
    if (!source) return [];
    ECHARTS_FENCE_RE_GLOBAL.lastIndex = 0;
    const blocks = [];
    let match;
    while ((match = ECHARTS_FENCE_RE_GLOBAL.exec(source)) !== null) {
      blocks.push({
        start: match.index,
        end: ECHARTS_FENCE_RE_GLOBAL.lastIndex,
        full: match[0],
        body: match[1] || ''
      });
    }
    return blocks;
  };

  const extractEchartsJsonPayload = (rawText) => {
    const source = normalizeText(rawText);
    if (!source) return '';
    const blockMatch = source.match(ECHARTS_FENCE_RE_SINGLE);
    if (blockMatch?.[1]) return blockMatch[1].trim();
    const firstCurly = source.indexOf('{');
    const lastCurly = source.lastIndexOf('}');
    if (firstCurly >= 0 && lastCurly > firstCurly) {
      return source.slice(firstCurly, lastCurly + 1);
    }
    return source.trim();
  };

  const repairEchartsBlockWithAi = async ({ cfg, agentRuntime, latestUserText, rawBlock, reason }) => {
    const question = normalizeText(latestUserText).slice(0, 1200);
    const source = normalizeText(rawBlock).slice(0, 8000);
    if (!source) return null;

    const guardPrompt = [
      '你是 ECharts JSON 修复器。',
      '只输出严格合法的 JSON 对象，不要输出解释，不要输出 markdown 代码块。',
      '输出必须可直接 JSON.parse，并可被 ECharts setOption 使用。',
      '必须包含非空 series 数组；每个 series 必须有 type。',
      '禁止注释、禁止尾逗号、禁止单引号键名。',
      '禁止输出任何函数（formatter、itemStyle.color function 等）；需要格式化时改为静态字符串或数组。'
    ].join('\n');

    const upstream = await callAiUpstreamWithRetry({
      stream: false,
      messages: [
        { role: 'system', content: guardPrompt },
        {
          role: 'user',
          content: `用户问题：${question || '（未提供）'}\n修复原因：${normalizeText(reason) || 'JSON不可解析'}\n原始 ECharts 内容：\n${source}`
        }
      ]
    }, { cfg, agentRuntime, forceStream: false }, { maxRetries: 3, baseDelayMs: 260 });

    if (!upstream.ok || upstream.stream) return null;
    const candidate = stripFunctionValueBlocks(
      extractEchartsJsonPayload(cleanModelText(extractCompletionText(upstream.data)))
    );
    const parsed = parseJsonSafe(candidate);
    const normalized = normalizeEchartsOption(parsed);
    if (!validateEchartsOption(normalized)) return null;
    return normalized;
  };

  const normalizeEnterpriseEchartsBlocks = async ({ rawText, cfg, agentRuntime, latestUserText }) => {
    const source = normalizeText(rawText);
    if (!source) return { text: '', changed: false };
    const blocks = extractEchartsBlocks(source);
    if (blocks.length === 0) return { text: source, changed: false };

    let cursor = 0;
    let output = '';
    let changed = false;

    for (const block of blocks) {
      output += source.slice(cursor, block.start);
      cursor = block.end;

      let option = normalizeEchartsOption(parseJsonSafe(stripFunctionValueBlocks(block.body)));
      if (!validateEchartsOption(option)) {
        for (let attempt = 0; attempt < 6 && !validateEchartsOption(option); attempt += 1) {
          option = await repairEchartsBlockWithAi({
            cfg,
            agentRuntime,
            latestUserText,
            rawBlock: block.body,
            reason: `ECharts JSON parse/validate failed (attempt ${attempt + 1})`
          });
        }
      }
      if (!validateEchartsOption(option)) {
        option = buildFallbackEchartsOption();
      }

      const replacement = `\`\`\`echarts\n${JSON.stringify(option, null, 2)}\n\`\`\``;
      if (replacement !== block.full) changed = true;
      output += replacement;
    }

    output += source.slice(cursor);
    return { text: output, changed };
  };

  const rewriteEnterpriseResponse = async ({ cfg, agentRuntime, latestUserText, rawAnswer }) => {
    const answer = normalizeText(rawAnswer).slice(0, 20000);
    if (!answer) return '';
    const question = normalizeText(latestUserText).slice(0, 4000);
    const guardPrompt = [
      '你是企业经营分析智能体的输出守卫。',
      '你需要把回答改写为经营分析结果，禁止任何流程编排相关内容。',
      '严格删除：BPMN XML、workflow-meta、Mermaid流程图、审批节点定义。',
      '去掉客套开场语（如“好的、收到、我将…”），直接给报告正文。',
      '保持原回答中的经营分析结论和可执行建议。',
      '只输出最终正文，不要解释你做了什么。'
    ].join('\n');

    const upstream = await callAiUpstreamWithRetry({
      stream: false,
      messages: [
        { role: 'system', content: guardPrompt },
        {
          role: 'user',
          content: `用户问题：${question || '（未提供）'}\n\n原始回答：\n${answer}`
        }
      ]
    }, { cfg, agentRuntime, forceStream: false }, { maxRetries: 1, baseDelayMs: 240 });

    if (!upstream.ok || upstream.stream) return '';
    return cleanModelText(extractCompletionText(upstream.data));
  };

  const applyEnterpriseOutputGuard = async ({ data, route, cfg, agentRuntime }) => {
    if (!shouldApplyEnterpriseOutputGuard(route)) {
      return { guardedData: data, guardApplied: false };
    }

    const rawText = extractCompletionText(data);
    let guardedText = normalizeText(rawText);
    if (!guardedText) {
      return { guardedData: data, guardApplied: false };
    }

    let guardApplied = false;

    if (containsWorkflowLeak(guardedText)) {
      const rewritten = await rewriteEnterpriseResponse({
        cfg,
        agentRuntime,
        latestUserText: route?.latestUserText,
        rawAnswer: guardedText
      });
      if (rewritten) {
        guardedText = rewritten;
        guardApplied = true;
      }
    }

    const noPreambleText = stripEnterprisePreambleText(guardedText);
    if (noPreambleText && noPreambleText !== guardedText) {
      guardedText = noPreambleText;
      guardApplied = true;
    }

    const chartGuarded = await normalizeEnterpriseEchartsBlocks({
      rawText: guardedText,
      cfg,
      agentRuntime,
      latestUserText: route?.latestUserText
    });
    if (chartGuarded.changed && chartGuarded.text) {
      guardedText = chartGuarded.text;
      guardApplied = true;
    }

    if (!guardApplied) {
      return { guardedData: data, guardApplied: false };
    }

    return {
      guardedData: replaceCompletionText(data, guardedText),
      guardApplied: true
    };
  };

  return Object.freeze({
    applyEnterpriseOutputGuard,
    shouldApplyEnterpriseOutputGuard
  });
};

module.exports = {
  createAiOutputGuard
};
