'use strict';

const assert = require('node:assert/strict');
const { applyHarnessOutputPolicy, fallbackChart, normalizeChart, parseJsonLike, stripEnterprisePreamble, stripWorkflowContent } = require('./harness-output-policy');

assert.equal(stripEnterprisePreamble('好的，以下是经营分析报告\n正文结论'), '正文结论');
assert.equal(stripWorkflowContent('结论\n```mermaid\ngraph TD\nA-->B\n```\nworkflow-meta: approval'), '结论');

const normalized = normalizeChart(parseJsonLike("{ series: { type: 'bar', data: [1, 2,], label: { formatter: function(value) { return value; } } } }"));
assert.equal(normalized.series[0].type, 'bar');
assert.deepEqual(normalized.series[0].data, [1, 2]);
assert.deepEqual(normalized.xAxis, { type: 'category', data: [] });
assert.deepEqual(normalized.yAxis, { type: 'value' });

const invalid = applyHarnessOutputPolicy({ pluginId: 'enterprise-bi', data: { choices: [{ message: { role: 'assistant', content: '```echarts\nnot json\n```' } }] } });
assert.equal(invalid.changed, true);
assert.deepEqual(JSON.parse(invalid.data.choices[0].message.content.match(/```echarts\n([\s\S]+)\n```/)[1]), fallbackChart());

const workflow = applyHarnessOutputPolicy({ pluginId: 'enterprise-bi', data: { choices: [{ message: { content: '```mermaid\ngraph TD\nA-->B\n```\n经营结论' } }] } });
assert.equal(workflow.data.choices[0].message.content, '经营结论');

const passthrough = { choices: [{ message: { content: '普通回答' } }] };
const other = applyHarnessOutputPolicy({ pluginId: 'digital-twin', data: passthrough });
assert.equal(other.changed, false);
assert.equal(other.data, passthrough);

console.log('PASS: Harness enterprise output policy preserves plugin scope, preamble/workflow cleanup and safe ECharts fallback');
