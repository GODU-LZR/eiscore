import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { apply, responsePolicyForRequest, visualFormatForRequest } from './visual-response-policy.mjs'

for (const [request, format] of [
  ['请查询本月销售订单并生成柱状图', 'echarts'],
  ['按客户销售金额给我条形图', 'echarts'],
  ['用饼图展示销售占比', 'echarts'],
  ['销售趋势折线图', 'echarts'],
  ['请把这些数据可视化，图型由你选择', 'echarts'],
  ['Show sales as a bar chart', 'echarts'],
  ['把订单下推流程做成思维导图', 'mind'],
  ['请输出 mind 树', 'mind'],
  ['使用 DOT 画出审批流程', 'dot'],
  ['输出 dto 流程图', 'dot'],
  ['输出一个带按钮和内联 JavaScript 的 HTML 页面', 'html'],
  ['查询最新十笔订单', ''],
  ['不要图表，用文字说明', ''],
  ['本次不用柱状图', ''],
  ['Show totals without charts', ''],
  ["Don't use a bar chart; give the totals", ''],
  ['不要饼图，改为销售柱状图', 'echarts'],
  ['解释 ECharts 的 series 配置代码', ''],
  ['怎么修复柱状图组件代码中的报错', ''],
  ['How does ECharts render a bar chart?', ''],
  ['HTML 是什么？', ''],
  ['网页上的订单数量是多少', ''],
  ['解释以下代码：```js\nconst x = "柱状图"\n```', ''],
  ['看一下这个错误：`echarts.init is not a function`', ''],
  ['> 上一次要求：生成饼图\n现在只查询订单数量', '']
]) assert.equal(visualFormatForRequest(request), format, request)

const policy = responsePolicyForRequest('画销售柱状图')
assert.match(policy, /至少一个 echarts 代码块/)
assert.match(policy, /JSON\.parse/)
assert.match(policy, /ASCII/)
assert.match(policy, /柱状图必须为竖向，使用 xAxis\.type=category、xAxis\.data 列出类别、yAxis\.type=value/)
assert.match(policy, /条形图必须为横向，使用 yAxis\.type=category、yAxis\.data 列出类别、xAxis\.type=value/)
assert.match(policy, /不加入未经业务确认的审批、信用校验或其他分支规则/)
assert.match(policy, /自检引号、方括号、圆括号和花括号匹配/)
assert.ok(policy.includes('digraph G { a [label="节点A"]; b [label="节点B"]; a -> b; }'))
assert.match(policy, /字段\.asc/)
assert.match(policy, /order_date\.desc/)
assert.match(policy, /不能使用空格、ORDER BY/)
assert.match(policy, /不改变认证、权限、审批和写入确认/)
assert.doesNotMatch(responsePolicyForRequest('只报订单数量'), /至少一个 echarts 代码块/)

const events = new Map()
let section
apply({
  on: (event, listener) => events.set(event, listener),
  systemPrompt: {
    getSectionOrder: (name) => name === 'STRUCTURED_OUTPUT' ? 9900 : undefined,
    section: (value) => { section = value }
  }
})
assert.equal(section.order, 9900)
const claimed = events.get('agent/inbox/claimed')
const agentA = { session: { id: 'existing-owned-session' } }
const agentB = { session: { id: 'another-owned-session' } }
const message = Object.freeze({
  source: Object.freeze({ kind: 'user' }),
  content: Object.freeze([Object.freeze({ type: 'text', text: '请画销售柱状图' }), Object.freeze({ type: 'image', data: 'unchanged-image' })])
})
const before = JSON.stringify(message)
claimed({ agent: agentA, message })
assert.match(section.text({ agent: agentA }), /至少一个 echarts 代码块/)
assert.doesNotMatch(section.text({ agent: agentB }), /至少一个 echarts 代码块/)
assert.equal(JSON.stringify(message), before, 'The actual user message and attachments must remain unchanged')
for (const kind of ['tool', 'plugin', 'model']) {
  claimed({ agent: agentA, message: { source: { kind }, content: [{ type: 'text', text: '输出HTML' }] } })
  assert.match(section.text({ agent: agentA }), /至少一个 echarts 代码块/)
}
claimed({ agent: agentA, message: { source: { kind: 'user' }, content: [{ type: 'text', text: '现在不用图表，只报订单数量' }] } })
assert.doesNotMatch(section.text({ agent: agentA }), /至少一个 echarts 代码块/)
claimed({ agent: agentA, message: { source: { kind: 'user' }, content: [{ type: 'text', text: '给我思维导图' }] } })
assert.match(section.text({ agent: agentA }), /至少一个 mind 代码块/)
assert.doesNotMatch(section.text(), /至少一个 mind 代码块/)

console.log('PASS: visual request detection, per-agent claimed-user intent, existing sessions, unchanged messages, approval boundaries and sales query format')

const sdkRoot = process.env.DSH_TEST_MODULE_ROOT || resolve(fileURLToPath(new URL('../../..', import.meta.url)), 'agent-harness/node_modules')
const sdk = (name) => import(pathToFileURL(resolve(sdkRoot, '@deepseek-ai', name, 'lib/index.js')))
const [{ Context }, { SystemPrompt, renderPrompt }, { emitAgentEvent, assembleContextFor }, { createUserMessage }] = await Promise.all([
  sdk('cordis'), sdk('dsh-system-prompt'), sdk('dsh-agent'), sdk('dsh-llm')
])
const ctx = new Context()
const systemFiber = await ctx.plugin(SystemPrompt, { includeHarnessIdentity: true, includeRuntimeContext: false })
const policyFiber = await ctx.plugin(await import('./visual-response-policy.mjs'))
try {
  const resumedAgent = { session: { id: 'restored-owned-session' } }
  const request = createUserMessage({ content: [{ type: 'text', text: 'Show sales as a bar chart' }], source: { kind: 'user' } })
  emitAgentEvent(ctx, resumedAgent, 'agent/inbox/claimed', { message: request, turn: 1 })
  const system = renderPrompt(await ctx.systemPrompt.assemble(assembleContextFor(resumedAgent)))
  assert.match(system, /至少一个 echarts 代码块/)
  assert.equal(request.content[0].text, 'Show sales as a bar chart')
  emitAgentEvent(ctx, resumedAgent, 'agent/inbox/claimed', { message: createUserMessage({ content: [{ type: 'text', text: 'Just give the order count, no charts' }], source: { kind: 'user' } }), turn: 2 })
  assert.doesNotMatch(renderPrompt(await ctx.systemPrompt.assemble(assembleContextFor(resumedAgent))), /至少一个 echarts 代码块/)
  console.log('PASS: actual installed DSH event dispatch, official system-prompt section assembly and next-turn intent reset')
} finally {
  await policyFiber.dispose()
  await systemFiber.dispose()
}
