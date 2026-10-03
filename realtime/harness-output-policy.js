'use strict';
const WF = /```(?:bpmn-xml|workflow-meta|mermaid)[^\r\n]*\r?\n[\s\S]*?```/gi;
const WT = /(?:^|\n)\s*workflow-meta\s*:[^\n]*/gi;
const EF = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/gi;
const FL = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|先给出|先汇总|请查看|这里是).{0,100}(经营分析|经营报告|分析报告|报告|图表|洞察|结论)/;
const FS = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,90}(经营分析|经营报告|分析报告|报告)/g;
const text = (v) => String(v ?? '').trim();
const completionText = (d) => { const f = d?.choices?.[0] || {}; return text(f?.message?.content ?? f?.delta?.content ?? d?.text ?? d?.output_text ?? d?.content ?? ''); };
const replaceCompletionText = (d, v) => { const safe = text(v); const c = d && typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : {}; if (Array.isArray(c.choices) && c.choices.length) { const f = c.choices[0] || {}; if (f.message && typeof f.message === 'object') f.message.content = safe; else if (f.delta && typeof f.delta === 'object') f.delta.content = safe; else f.message = { role: 'assistant', content: safe }; c.choices[0] = f; } else c.choices = [{ index: 0, message: { role: 'assistant', content: safe }, finish_reason: 'stop' }]; if (Object.hasOwn(c, 'text')) c.text = safe; if (Object.hasOwn(c, 'output_text')) c.output_text = safe; return c; };
const stripWorkflowContent = (v) => text(v).replace(WF, '').replace(WT, '').replace(/\n{3,}/g, '\n\n').trim();
const stripEnterprisePreamble = (v) => { const s = text(v); if (!s) return ''; let removed = 0; return s.split(/\r?\n/).map((line) => { const t = line.trim(); if (t && removed < 5 && t.length <= 180 && FL.test(t)) { removed += 1; return ''; } return line.replace(FS, '').trimEnd(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim(); };
const stripFunctionValues = (value) => {
  const source = text(value);
  if (!source.includes(': function')) return source;
  let output = ''; let cursor = 0;
  while (cursor < source.length) {
    const token = source.indexOf(': function', cursor);
    if (token < 0) return output + source.slice(cursor);
    output += source.slice(cursor, token) + ': null';
    let index = source.indexOf('{', token);
    if (index < 0) return output;
    let depth = 0; let quote = false; let escaped = false;
    for (; index < source.length; index += 1) {
      const ch = source[index];
      if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quote = false; continue; }
      if (ch === '"') { quote = true; continue; }
      if (ch === '{') depth += 1;
      if (ch === '}' && --depth === 0) { index += 1; break; }
    }
    cursor = index;
  }
  return output;
};
const parseJsonLike = (v) => { let s = stripFunctionValues(v).replace(/^\uFEFF/, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); s = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3'); const first = s.search(/[{[]/); if (first > 0) s = s.slice(first); const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']')); if (last > 0) s = s.slice(0, last + 1); try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/'/g, '"')); } catch { return null; } } };
const normalizeChart = (v) => { if (!v || typeof v !== 'object' || Array.isArray(v)) return null; const o = JSON.parse(JSON.stringify(v)); if (o.series && !Array.isArray(o.series)) o.series = [o.series]; if (!Array.isArray(o.series) || !o.series.length) return null; o.series = o.series.filter((x) => x && typeof x === 'object').map((x) => ({ ...x, type: text(x.type) || 'line' })); if (!o.series.length) return null; const axis = o.series.some((x) => ['line', 'bar', 'scatter'].includes(String(x.type).toLowerCase())); if (axis) { if (!o.xAxis) o.xAxis = { type: 'category', data: [] }; if (!o.yAxis) o.yAxis = { type: 'value' }; } if (!o.tooltip) o.tooltip = { trigger: axis ? 'axis' : 'item' }; return o; };
const fallbackChart = () => ({ animation: false, grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false }, xAxis: { type: 'category', show: false, data: [''] }, yAxis: { type: 'value', show: false }, tooltip: { show: false }, series: [{ name: '', type: 'line', data: [0], showSymbol: false, lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 }, areaStyle: { opacity: 0 } }] });
const normalizeCharts = (v) => { const s = text(v); if (!s) return { text: s, changed: false }; EF.lastIndex = 0; let cursor = 0; let out = ''; let changed = false; let m; while ((m = EF.exec(s))) { out += s.slice(cursor, m.index); const o = normalizeChart(parseJsonLike(m[1])) || fallbackChart(); const replacement = String.fromCharCode(96, 96, 96) + 'echarts\n' + JSON.stringify(o, null, 2) + '\n' + String.fromCharCode(96, 96, 96); out += replacement; changed ||= replacement !== m[0]; cursor = EF.lastIndex; } return { text: out + s.slice(cursor), changed }; };
const applyHarnessOutputPolicy = ({ data, pluginId = '' } = {}) => { if (String(pluginId).trim() !== 'enterprise-bi') return { data, changed: false }; const original = completionText(data); if (!original) return { data, changed: false }; let next = stripWorkflowContent(original); next = stripEnterprisePreamble(next); next = normalizeCharts(next).text; if (next === original) return { data, changed: false }; return { data: replaceCompletionText(data, next), changed: true }; };
module.exports = { applyHarnessOutputPolicy, completionText, fallbackChart, normalizeCharts, normalizeChart, parseJsonLike, replaceCompletionText, stripEnterprisePreamble, stripWorkflowContent };
