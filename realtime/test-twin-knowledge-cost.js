// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

// Regression test for knowledge-base cost table analysis.
// Runs fully local: mock LLM + mock PostgREST, no network or database required.
'use strict';

const assert = require('assert');
const { TwinEngine, parseToolCalls } = require('./twin-engine');
const { createTwinTools, buildTwinSystemPrompt } = require('./twin-tools');

const costTableText = [
  '[Sheet: 成本表]',
  '项目,类别,金额,月份',
  '原料A,直接材料,12800,2026-05',
  '原料B,直接材料,9400,2026-05',
  '包装物,制造费用,2100,2026-05',
  '人工,直接人工,7600,2026-05',
  '能耗,制造费用,3300,2026-05',
  '物流,期间费用,1800,2026-05',
  '总成本,,37000,2026-05'
].join('\n');

const mockFile = {
  id: 'kb-cost-001',
  file_name: '成本表.xlsx',
  file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  file_size: 8192,
  tags: ['成本'],
  summary: '',
  content_text: costTableText,
  created_at: '2026-05-28T10:00:00Z',
  updated_at: '2026-05-28T10:00:00Z'
};

async function pgQuery(options) {
  assert.strictEqual(options.path, '/twin_knowledge_files');
  if (options.query?.id === 'eq.kb-cost-001') {
    return { data: [mockFile] };
  }
  return { data: [mockFile] };
}

function toolCall(name, parameters) {
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: `\`\`\`json\n${JSON.stringify({ tool: name, parameters }, null, 2)}\n\`\`\``
      }
    }]
  };
}

async function main() {
  const parsedArrayCalls = parseToolCalls('```json\n[{"tool":"search_knowledge","parameters":{"query":"成本表"}},{"tool":"read_knowledge_file","parameters":{"id":"kb-cost-001"}}]\n```');
  assert.deepStrictEqual(
    parsedArrayCalls.map(item => item.tool),
    ['search_knowledge', 'read_knowledge_file'],
    'parser should support fenced JSON array tool calls'
  );

  const user = { username: 'admin', role: 'super_admin' };
  const tools = createTwinTools(pgQuery, user);
  const calls = [];

  const engine = new TwinEngine({
    tools,
    systemPrompt: buildTwinSystemPrompt(user),
    model: 'mock-model',
    maxTurns: 5,
    turnDelayMs: 0,
    aiCaller: async ({ messages }) => {
      calls.push(messages[messages.length - 1].content);
      if (calls.length === 1) {
        return toolCall('search_knowledge', { query: '成本表', limit: 3 });
      }
      if (calls.length === 2) {
        return toolCall('read_knowledge_file', { id: 'kb-cost-001' });
      }
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: [
              '成本表分析',
              '',
              '- 使用文件：成本表.xlsx',
              '- 总成本：37000',
              '',
              '```echarts',
              JSON.stringify({
                title: { text: '成本构成' },
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: ['直接材料', '直接人工', '制造费用', '期间费用'] },
                yAxis: { type: 'value' },
                series: [{ name: '金额', type: 'bar', data: [22200, 7600, 5400, 1800] }]
              }, null, 2),
              '```'
            ].join('\n')
          }
        }]
      };
    }
  });

  const result = await engine.run('请你分析一下我知识库里面的成本表，图文并茂', [], { sessionId: null });

  assert.ok(result.answer.includes('成本表分析'), 'final answer should not be empty');
  assert.ok(result.answer.includes('```echarts'), 'final answer should include an echarts block');
  assert.strictEqual(result.toolLogs.length, 2, 'should call search and read tools');
  assert.deepStrictEqual(result.toolLogs.map(item => item.tool), ['search_knowledge', 'read_knowledge_file']);
  assert.ok(result.toolLogs[1].output.content.includes('总成本'), 'read tool should return table content');

  console.log('PASS: twin knowledge cost-table analysis regression');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
