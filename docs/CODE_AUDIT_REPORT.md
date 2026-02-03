# 项目代码审核报告（不含 eiscore-apps）

更新时间：2026-02-02

## 1. 范围与方法
- 范围：`eiscore-base`、`eiscore-hr`、`eiscore-materials`、`realtime`、`sql`、`env`、`scripts`、`nginx`、`docs`（仅核对历史报告）。
- 排除：`eiscore-apps`（按要求不纳入本次审核）。
- 方法：静态代码审阅 + 与历史审核文档对齐核实；未进行运行时测试、接口联调或安全渗透。

## 2. 结论摘要
- 关键风险：1
- 高风险：1
- 中风险：4
- 低风险/清理：2
- 已核实修复/过时项：4（见“既有报告对齐结果”）

## 3. 关键风险（需优先修复）
1) 远程代理执行的文件与命令边界缺失，存在越权文件访问与命令注入风险
- 影响：认证用户可通过 WebSocket 指令读取/写入工作区外文件，或执行拼接命令，存在数据泄露与 RCE 风险。
- 证据：`realtime/index.js`（agent:task/agent:tool_use 入口），`realtime/agent-core.js`（`projectPath` 未校验、`path.join` 可被 `..` 穿透，`executeCommand` 仅用 `startsWith` 过滤）。
- 建议：
  - 对 `projectPath` 做白名单校验并限制到固定子目录；加入 `path.resolve` 后的前缀检查。
  - 禁止或严格限制 `execute_command`（只允许精确匹配的命令列表，拒绝 `&&`、`;` 等拼接）。
  - 对 agent 操作加 RBAC/审计，必要时仅允许运维角色使用。

## 4. 高风险
1) AI 聊天渲染允许原始 HTML，存在 XSS 风险
- 影响：AI 输出或用户输入可注入 HTML/JS，进而窃取本地存储的 token/权限信息。
- 证据：`eiscore-base/src/components/AiCopilot.vue`（`MarkdownIt({ html: true })` + `v-html` 渲染）。
- 建议：关闭 `html` 选项或引入 DOMPurify 等白名单清洗；对 Mermaid/ECharts 渲染结果也做安全处理。

## 5. 中风险
1) WebSocket 客户端未携带鉴权信息，实时通道可能无法建立
- 影响：服务端要求 JWT 的情况下，HR/物料端实时订阅会被直接拒绝（功能性中断）。
- 证据：`eiscore-hr/src/utils/realtime.js`、`eiscore-materials/src/utils/realtime.js`（`new WebSocket(url)` 无 token），服务端 `realtime/index.js` 使用 `sec-websocket-protocol` 解析 token。
- 建议：按服务端约定传入协议头，如 `new WebSocket(url, ['bearer', token])`，或改为 query/header 方案并统一实现。

2) 公式计算使用 `new Function` 执行表达式，存在可执行注入面
- 影响：若公式配置被恶意写入，可在用户浏览器执行任意 JS（属于存储型脚本执行风险）。
- 证据：`eiscore-hr/src/components/eis-data-grid-v2/composables/useGridFormula.js`、`eiscore-materials/src/components/eis-data-grid-v2/composables/useGridFormula.js`、`eiscore-hr/src/views/EmployeeDetail.vue`、`eiscore-materials/src/views/MaterialDetail.vue`。
- 建议：使用安全表达式解析器（如 expr-eval / jsep + 白名单运算符），禁止任意 JS 执行。

3) 子应用用户信息解析缺少容错，可能导致启动时崩溃
- 影响：`localStorage.user_info` 非法 JSON 时会抛错，导致 Pinia store 初始化失败。
- 证据：`eiscore-hr/src/stores/user.js`、`eiscore-materials/src/stores/user.js`（`JSON.parse` 无 try/catch）。
- 建议：补充 `try/catch` 并回退为空对象；同时可在写入时统一校验。

4) 系统设置保存未校验响应状态，可能误报保存成功
- 影响：后端返回 4xx/5xx 仍会被视作成功，导致配置丢失或 UI 误导。
- 证据：`eiscore-base/src/stores/system.js`（`saveConfig` 未检查 `res.ok`）。
- 建议：检查 `res.ok` 或解析错误体并返回失败；必要时在 UI 提示具体错误。

## 6. 低风险/清理建议
1) 组件未被引用且包含潜在逻辑缺陷
- 现状：`eiscore-hr/src/components/AclTable.vue` 未被其它文件引用；内部 `toggle` 事件未透传列信息，`canEdit/canDelete` 固定返回 true。
- 建议：若已弃用可删除；若保留需补齐权限判断并修正事件参数。

2) 打印功能直接拼接 `outerHTML` 写入新窗口，存在潜在 HTML 注入面
- 现状：`eiscore-hr/src/views/EmployeeDetail.vue`、`eiscore-materials/src/views/MaterialDetail.vue` 使用 `document.write` + `paper.outerHTML`。
- 风险：若打印内容包含未转义的富文本/HTML 字段，可能在打印窗口触发脚本执行。
- 建议：确保所有字段内容均为文本渲染（无 `v-html`），或在打印前对可疑字段进行转义/清洗。

## 7. 既有报告对齐结果（已核实）
- “应用表格列权限首次进入重复/列异常”已被处理：`eiscore-hr/src/views/HrAclView.vue` 使用 `allowedFieldCodes` 并在空列表时返回 `limit=0`，避免初次全量回显。
- “列锁样式误用”已修复：`eiscore-hr/src/views/HrAclView.vue` 关闭 `enable-column-lock`。
- “AI 回复图表出现小条”已修复：`eiscore-base/src/components/AiCopilot.vue` 对空图表节点 `display:none`。
- “微前端 /apps 路由不一致”已过时：`eiscore-base/src/micro/apps.js` 当前 `entry` 与 `activeRule` 均为 `/apps/`，未发现旧报告中的不一致。
- 旧报告中提到的 `ColumnManagerDialog` 重复逻辑未在 `eiscore-hr/src/components/eis-data-grid-v2/index.vue` 中发现；视为不适用。

## 8. 覆盖说明与建议补充
- 本次为静态审阅，未执行运行时测试/联调，SQL 逻辑与权限策略仅做结构性浏览。
- 建议后续补充：
  - 对 `realtime` 模块做鉴权与命令执行的安全审计。
  - 关键 UI（登录、权限、表格）做最小化 E2E 验证。
  - 对 AI 渲染链路增加 XSS 单元测试或静态扫描规则。

## 9. 修复计划（建议顺序）
P0（阻断性安全风险）
1. 限制 `realtime` agent 的路径与命令执行边界（白名单 + path.resolve 前缀校验 + 严格命令表）。
2. 对 agent 操作加入 RBAC 与审计记录（至少记录调用人、时间、参数、结果）。

P1（高风险）
3. AI 渲染统一启用 HTML 清洗（关闭 `MarkdownIt` 的 `html` 或加入 DOMPurify）；同时对 Mermaid/ECharts 渲染结果做安全处理。
4. 替换所有 `new Function` 公式计算为安全表达式解析器（抽取统一工具，HR/Materials/旧 v1 组件共用）。

P2（中风险/稳定性）
5. 修复 WebSocket 鉴权缺失（HR/Materials 客户端带 token，服务端保持一致校验）。
6. 为子应用 `user_info` 解析增加 try/catch 与降级逻辑。
7. 系统设置保存检查 `res.ok` 并返回失败提示。

P3（低风险/清理）
8. 评估删除未引用的 `AclTable.vue`。
9. 打印功能对可疑字段做转义/清洗，避免打印窗口注入。

## 10. 修复进度（已实施）
- 已完成：`realtime` agent 路径/命令校验 + RBAC + 审计日志（见 `realtime/index.js`、`realtime/agent-core.js`）。
- 已完成：AI 渲染关闭 raw HTML，增加 Markdown/SVG 清洗（见 `eiscore-base/src/components/AiCopilot.vue`）。
- 已完成：公式计算替换为安全解析器（新增 `shared/utils/formula-eval.js`，并应用到 v1/v2/detail）。
- 已完成：WebSocket 客户端携带鉴权 token（见 `eiscore-hr/src/utils/realtime.js`、`eiscore-materials/src/utils/realtime.js`）。
- 已完成：子应用 `user_info` 解析容错（见 `eiscore-hr/src/stores/user.js`、`eiscore-materials/src/stores/user.js`）。
- 已完成：系统设置保存检查 `res.ok`（见 `eiscore-base/src/stores/system.js`）。
- 已完成：打印窗口内容清洗（见 `eiscore-hr/src/views/EmployeeDetail.vue`、`eiscore-materials/src/views/MaterialDetail.vue`）。
- 已调整：`AclTable` toggle 事件透传列信息（见 `eiscore-hr/src/components/AclTable.vue`）。
- 已完成：401 自动跳转登录（路由守卫 + axios + fetch 全局拦截）。
