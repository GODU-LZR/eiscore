# EISCore -> DeepSeek Harness 完整迁移提示词与实施规格

> 用途：把 EISCore 现有 Agent 能力迁移为 DeepSeek Harness 插件，并逐步移除旧 Agent 编排和旧模型调用。
>
> 适用仓库：`/home/lzr/eiscore-refactor`

## 1. 可直接交给 Codex 的主提示词

你正在维护 EISCore 的 DeepSeek Harness 重构版本。请将现有 Agent 能力迁移为 DeepSeek Harness 插件，并移除旧 Agent 编排与旧模型直连。你的目标是完成可验证的后端迁移，不是增加一个包装层或继续扩大 Legacy Runtime。

### 任务目标

将系统从：

```text
EISCore Runtime 编排 Agent -> 旧模型 API -> EISCore 业务逻辑
```

迁移到：

```text
DeepSeek Harness 插件 -> EISCore Harness Gateway -> EISCore Tool Gateway
                         -> PostgREST / RPC -> PostgreSQL + RLS
```

DeepSeek Harness 负责 Agent Loop、模型调用、提示词上下文、多轮会话、工具选择和流式协议。EISCore 负责认证、租户、权限、RLS、业务 RPC、审批、幂等、审计、文件处理、会话持久化和协议适配。

### 必须遵守的边界

1. 插件不能直接连接 PostgreSQL。
2. 插件不能使用数据库超级用户。
3. 插件不能自行决定用户、租户、角色或权限范围。
4. 所有业务数据访问必须通过 EISCore Gateway、PostgREST 或受控 RPC。
5. 所有写操作必须通过服务端权限检查、显式确认、幂等键和审计。
6. 不得把 JWT、API Key、租户标识或内部 URL 放进模型提示词、浏览器 URL 或前端 localStorage。
7. 不得以兼容为理由继续增加旧 Agent 编排代码。
8. 不得在没有测试保护的情况下直接删除旧业务规则。
9. 现有未提交改动属于用户，先检查并保留；不要重置、覆盖或格式化无关文件。
10. 远程生产、真实租户和真实数据测试只有在任务明确授权时执行。

### 旧能力的处理原则

对同时包含 Agent 编排和业务逻辑的文件进行拆分：

- 删除 Prompt 组装、ReAct 循环、模型调用、模型重试、旧工具选择和 Legacy fallback。
- 保留权限检查、输入校验、业务规则、RPC 调用、事务边界、持久化、审计和协议转换。
- 将保留的业务能力包装成最小、单职责、可测试的 Harness Tool。
- Harness 插件只描述能力和调用参数，不复制数据库权限逻辑。

## 2. 迁移对象清单

### 2.1 Enterprise BI

插件：`enterprise-bi`

建议工具：

- `eiscore_enterprise_snapshot`
- `eiscore_business_query`
- `eiscore_business_chart`（只返回受约束的图表配置）

要求：模型不能提交用户、租户、SQL、数据库 URL 或任意表名作为授权依据。关系、列和数据范围由 EISCore Gateway 从可信请求上下文解析。

### 2.2 Worker Grid

插件：`worker-grid`

建议工具：

- `eiscore_grid_query`
- `eiscore_grid_summary`

要求：当前表格关系、列白名单、查询能力和分页边界由服务端签名或服务端选择。模型输入只能是业务问题，不能直接提交 SQL、Schema、租户或用户字段。

### 2.3 Digital Twin

插件：`digital-twin`

建议工具：

- `eiscore_twin_context`
- `eiscore_twin_session`
- `eiscore_twin_message`

要求：保留会话归属检查和消息持久化；删除旧 `TwinEngine` 的 ReAct 编排。Harness 负责多轮推理和工具选择，EISCore 负责会话所有权和业务查询。

### 2.4 Workflow

插件：`workflow`

建议工具：

- `eiscore_workflow_context`
- `eiscore_workflow_definition_create`
- `eiscore_workflow_assignment_upsert`
- `eiscore_workflow_instance_start`
- `eiscore_workflow_instance_transition`
- `eiscore_workflow_task_approval`
- `eiscore_workflow_mapping_upsert`

要求：每个写工具都声明风险、确认要求、幂等要求和审计要求。流程状态只能由 EISCore 业务层和数据库约束推进。

### 2.5 Company Sales

插件：`company-sales`

建议工具：

- `eiscore_sales_context`
- `eiscore_lead_draft_create`
- `eiscore_opportunity_draft_create`
- `eiscore_quote_draft_create`
- `eiscore_order_draft_create`
- `eiscore_sales_approval`
- `eiscore_sales_sync_enqueue`

要求：独立站匿名访客只能创建属于当前访客会话的 lead draft；报价、订单、生产草稿、审批和同步必须要求企业销售权限。

### 2.6 Document Intake

插件：`document-intake`

建议工具：

- `eiscore_document_parse`
- `eiscore_document_plan`
- `eiscore_document_commit`

要求：解析和规划可以返回结构化结果；提交只能提交已生成且已确认的计划，必须支持幂等和操作员可追溯。不要让模型直接写业务表。

### 2.7 Flash Builder

插件：`flash-builder`

建议工具：

- `eiscore_flash_registry`
- `eiscore_flash_route_resolve`
- `eiscore_flash_tool_read`
- `eiscore_flash_tool_write`

要求：保留现有 semantic tool registry、确认流程、幂等协调器和审计。删除旧 Cline 模型调用链；Cline 不再作为 Agent 编排后端。

### 2.8 Engineering

插件：`engineering`

建议工具：

- `eiscore_engineering_context`
- `eiscore_implementation_policy`

要求：没有可信的租户项目源时返回明确的无数据结果，不得伪造项目、任务或权限信息。

### 2.9 Independent Site Sales

插件：`independent-site-sales`

建议工具：

- `eiscore_site_sales_knowledge`
- `eiscore_site_sales_lead_draft`

要求：只读取当前有效且已发布的知识；不得访问企业内部客户、价格、库存、订单或生产数据。匿名会话和企业销售会话必须分开。

## 3. Legacy 删除范围

### 必须移除

- `callAiUpstream()` 和 `callAiUpstreamWithRetry()`。
- 旧 AI API 地址、旧 AI API Key 和仅供旧模型的配置读取。
- 旧 Agent 的 Prompt 编排和 ReAct 循环。
- 旧数字分身 `TwinEngine` 的模型驱动主循环。
- 旧 company-sales Agent 模型调用。
- 旧 document intake Agent 模型调用。
- 旧 Flash Cline 模型执行链。
- Harness 失败后调用 Legacy 的 fallback 分支。
- Legacy shadow 对比和仅用于旧链路的重试逻辑。
- 仅为 Legacy 服务的测试、环境变量、注释和部署占位。

### 必须保留

- EISCore `realtime` 服务作为 Gateway、Tool Gateway 和业务执行层。
- JWT、用户、角色、租户和权限检查。
- PostgREST/RPC 调用及 RLS。
- 工作流状态、审批、销售草稿、文档计划和 Flash 工具业务逻辑。
- 会话归属、消息保存、SSE、WebSocket 和事件通知。
- 写确认、幂等键、审计账本、恢复和故障关闭。

### 不允许的伪迁移

以下做法不算完成：

- 只把旧模型 URL 改成 Harness URL。
- 保留旧 Agent Loop，只把模型请求转发给 Harness。
- Harness 失败时自动调用旧模型。
- 继续在 `realtime/index.js` 中堆积新的业务 Agent 逻辑。
- 用 fixture 或合成租户证明真实 RLS 已通过。
- 只修改迁移目录状态而没有真实插件、工具和测试。

## 4. 迁移阶段

### 阶段 A：盘点和契约冻结

输出：

- Agent -> legacy 入口 -> 业务工具映射表。
- 每个工具的输入、输出、权限、风险、确认和幂等定义。
- 当前行为特征测试和协议测试。
- 旧模型调用点清单。

完成条件：所有旧 Agent 都能映射到一个 Harness 插件或明确列为无迁移目标。

### 阶段 B：业务工具抽取

输出：

- 每个插件的 manifest。
- Gateway handler 和稳定错误码。
- 读工具和写工具的最小测试。
- 不直接暴露数据库的调用路径。

完成条件：工具可以独立验证权限和业务结果，不需要旧 Agent Loop。

### 阶段 C：Harness 主链接入

输出：

- Host/Client 插件。
- Gateway -> Bridge -> Harness 的真实请求链。
- SSE、session、request id 和工具上下文签名验证。
- 所有 Agent 的 allowlist 和迁移目录一致。

完成条件：每个 Agent 的主请求都能从 Harness 进入 EISCore Tool Gateway。

### 阶段 D：关闭旧链路

执行顺序：

1. 先禁止新请求进入 Legacy。
2. Harness 失败返回稳定错误，不再 fallback。
3. 删除旧模型调用和重试。
4. 删除旧 Agent Loop。
5. 删除旧配置和无效依赖。
6. 删除旧 shadow 代码和迁移兼容分支。

完成条件：代码搜索不到生产可达的旧模型调用和 fallback 路径。

### 阶段 E：验证和发布

必须验证：

- `npm run test:syntax`
- `npm run test:unit`
- 各插件契约测试
- 真实双租户 RLS 负向测试
- 写确认、幂等和审计测试
- SSE/WebSocket 协议测试
- Harness 重启和 session 恢复测试
- Docker clean build 和容器安全测试
- 完整业务链路测试

## 5. 错误和回滚策略

Harness 失败时返回稳定错误，例如：

```json
{
  "code": "HARNESS_UPSTREAM_UNAVAILABLE",
  "message": "DeepSeek Harness is unavailable"
}
```

禁止自动换到旧 Agent 或旧模型。

生产回滚使用上一个完整容器镜像和 Git 版本，不使用当前代码内的 Legacy fallback。回滚前保留审计日志、Harness session 数据和数据库备份；不得通过删除卷隐藏故障。

## 6. 完成定义

只有同时满足以下条件，才可以删除 Legacy 源码：

- 所有目标 Agent 都有已注册插件。
- 所有业务工具都有服务端授权。
- 所有写工具都有确认、幂等和审计。
- 所有主入口都经过 Harness。
- 旧模型直连和 fallback 已删除。
- 旧 Agent Loop 已删除。
- RLS、会话归属和匿名边界验证通过。
- Harness 宕机时不会执行旧链路。
- 运行、测试、部署文档与代码一致。
- 上一个版本镜像已经作为独立回滚制品保存。

## 7. 执行输出格式

每个阶段结束时输出：

```text
已完成：
- ...

修改文件：
- ...

验证命令：
- 命令：...；结果：...

未完成：
- ...

风险和回滚：
- ...
```

禁止用“理论上完成”“应该可以”替代命令结果。
