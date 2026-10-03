# 给后端 Codex 智能体的任务提示词

你只负责 EISCore 的后端迁移。目标是把原有 Agent 功能做成 DeepSeek Harness 插件，并尽量剔除旧 Agent 编排和旧模型调用。你不负责前端 UI，不负责网站视觉，不负责浏览器交互，也不负责未经授权的生产部署。

## 工作目录和范围

仓库：`/home/lzr/eiscore-refactor`

重点目录：

```text
realtime/                 EISCore Gateway、业务执行和协议适配
agent-harness/            Bridge、插件契约、插件目录和容器配置
scripts/                  迁移门禁、审计和验收脚本
tests/                    后端、业务和工程契约测试
sql/、database/、env/     数据库结构、补丁和治理证据
docs/engineering/         工程说明和验收记录
```

允许修改：后端 JS、Harness 插件、Bridge、Gateway、后端测试、必要的环境样例、数据库迁移和工程文档。

禁止修改：前端 Vue 页面、CSS、图片、视觉设计、浏览器交互、客户资料；除非后端协议变化确实需要同步接口声明，并且必须在结果中说明。

禁止执行：`git reset --hard`、`git checkout --`、删除用户未提交文件、连接远程生产或写入真实部署环境。

开始前执行：

```bash
git status --short --branch
git log -5 --oneline --decorate
```

既有修改属于用户，保留并避开无关文件。

## 任务目标

将运行链路变成：

```text
DeepSeek Harness Plugin
  -> EISCore Harness Gateway
  -> EISCore Tool Gateway
  -> PostgREST / RPC
  -> PostgreSQL + RLS
```

删除以下旧职责：

- 旧 Agent Loop
- 旧 Prompt 编排
- 旧模型 API 直连
- 旧模型重试
- 旧 Agent 工具选择
- Harness 失败后的 Legacy fallback
- 仅供 Legacy 使用的模型配置和依赖

保留以下职责：

- JWT、session、tenant、role 和权限验证
- RLS 透传和 PostgREST/RPC 调用
- 业务写入、事务、状态机和审批
- 幂等键和审计账本
- 文件解析和文档计划提交
- 数字分身会话归属和消息持久化
- SSE、WebSocket 和请求取消
- 稳定错误码、日志和恢复探针

## 后端实施顺序

### 1. 建立现状基线

检查并记录：

- `realtime/index.js` 的所有 AI 入口。
- `callAiUpstream`、`callAiUpstreamWithRetry` 的全部调用者。
- `TwinEngine`、company-sales、document-intake、workflow、Flash 中的模型调用点。
- 所有 `fallback`、`shadow`、`legacy` 和 `EISCORE_HARNESS_*` 相关分支。
- `agent-harness/MIGRATION_CATALOG.json` 和各插件 manifest 的一致性。

不要先删文件。先添加或确认特征测试，保护会话归属、权限、业务写入和协议行为。

### 2. 逐插件抽取工具

至少覆盖：

```text
enterprise-bi
worker-grid
digital-twin
workflow
company-sales
document-intake
flash-builder
engineering
independent-site-sales
```

每个工具必须明确：

- `agent_id`
- `plugin_id`
- `capability_id`
- `intent`
- `object`
- `risk`
- `permissions`
- `input_schema`
- `output_schema`
- `confirm_required`
- `idempotency_required`
- `audit_required`
- `timeout_ms`

工具 handler 必须：

1. 校验认证上下文。
2. 从已验证的 JWT/session 取得用户和租户，不信任模型传入的主体字段。
3. 在 Gateway 侧校验权限和资源范围。
4. 通过现有 PostgREST/RPC 或业务 service 执行。
5. 对写操作执行确认、幂等和审计。
6. 返回稳定、最小化且不泄露内部实现的错误。

### 3. 接入 Harness

复用现有：

- `realtime/harness-gateway.js`
- `agent-harness/http-bridge.js`
- `agent-harness/plugin-contract.v1.json`
- 工具上下文 HMAC
- request id
- session ownership
- replay protection

不重新实现已有安全逻辑。插件不直连数据库，不在插件中复制 RLS，不将 JWT 写入提示词。

### 4. 移除旧模型调用

只有在对应 Harness 工具和测试可用后，才删除旧调用。

删除顺序：

1. 调整入口，使 Harness 成为唯一可达路径。
2. Harness 失败返回错误，不 fallback。
3. 删除 `callAiUpstream*` 的生产调用者。
4. 删除旧 Agent Loop 和旧模型适配器。
5. 删除旧配置字段、环境变量和无效依赖。
6. 删除只服务于旧路径的测试和文档。

如果同一函数被业务处理器和旧 Agent 同时调用，先抽取业务层 service，再删除旧 Agent 分支。

## 重要后端边界

### 租户和 RLS

- 不能接受模型提供的 `user_id`、`tenant_id`、JWT 或 PostgREST URL 作为授权依据。
- A 租户的 token 查询不到 B 租户数据，反向也必须为空。
- 空数据、缺配置、无签名 token 和跨租户行必须故障关闭。
- 合成 fixture 只能测试代码契约，不能宣称真实租户验收通过。

### 写操作

写操作必须满足：

```text
已认证
  + 有业务权限
  + confirmed=true
  + 16-128 字符幂等键
  + capability 匹配
  + 审计事件可持久化
```

审计失败时不能确认写入成功。若业务操作已完成但终态审计失败，返回需要使用相同幂等键对账的稳定错误，不自动重试。

### 数字分身

保留：

- session UUID 校验
- 当前用户 session ownership
- 历史消息读取
- 最终消息持久化
- SSE 头、取消和结束帧

删除：

- `TwinEngine` 的模型推理循环
- 旧工具选择循环
- 旧模型流式调用

### 文档入单

解析、规划、确认和提交是不同阶段。模型可以通过 Harness 生成或选择计划，但提交 handler 必须只接受服务端可验证的计划 ID/版本和幂等键，不能直接接受模型拼出的任意 SQL 或业务表字段。

### Flash

保留现有 semantic registry、工具白名单、风险级别、写确认和幂等协调器。删除 Cline 作为旧模型/Agent 执行器的路径。文件写入必须仍受项目路径和服务端权限限制。

## 错误处理要求

Harness 不可用时使用稳定错误，例如：

```json
{
  "code": "HARNESS_UPSTREAM_UNAVAILABLE",
  "message": "DeepSeek Harness is unavailable"
}
```

不要把 API Key、JWT、内部路径、Docker 配置、数据库错误原文、提示词或回答全文写进匿名错误响应、审计账本或日志。

## 测试要求

每个后端改动至少增加一个能失败的契约测试。重点测试：

- Harness 请求成功。
- Harness 失败时不调用 Legacy。
- 未认证、无租户、无权限时故障关闭。
- 跨租户读取为空。
- 写操作缺确认、幂等键或审计时被拒绝。
- 重放 request/tool context 被拒绝。
- 数字分身 SSE、会话归属、消息保存和客户端断开。
- 文档计划提交只接受服务端计划。
- Flash 工具白名单和项目边界。
- 所有迁移目录 Agent 与插件路由双向一致。

至少运行：

```bash
npm run test:syntax
npm run test:unit
node agent-harness/test-plugin-registry.js
node agent-harness/test-write-boundary.js
node realtime/test-harness-gateway.js
node scripts/migration-switch-gate.mjs
```

如果环境缺少 Docker、真实租户或 DeepSeek API，不要伪造通过；记录实际阻塞原因。

## 代码质量约束

- 不要把新的业务流程继续写进巨型 `realtime/index.js`。
- 优先复用已有 handler、service、权限 helper 和审计 helper。
- 数据库结构变化必须使用有序迁移文件。
- 不要新增客户名称、域名、默认密码或密钥硬编码。
- 不要为了“以后可能需要”新增抽象。
- 每一步保持语法和相关测试可运行。
- 删除代码前确认没有业务调用者；使用 `grep`/`rg` 检查所有引用。

## 提交前检查

```bash
git diff --check
git status --short
npm run test:syntax
npm run test:unit
```

然后检查：

- 生产可达路径中没有旧模型 API 直连。
- 生产可达路径中没有 Legacy fallback。
- 没有因为删除 Agent 而删除业务权限、RLS、持久化或审计。
- 文档、插件 manifest、迁移目录和实际路由一致。
- 变更只覆盖后端边界。

## 汇报格式

完成后用以下格式汇报：

```text
目标：
- 本次迁移的 Agent/插件：...

已完成：
- ...

删除的旧能力：
- ...

保留的业务能力：
- ...

修改文件：
- ...

验证：
- 命令：...；结果：...

未完成或阻塞：
- ...

回滚方式：
- ...
```

不要只报告“代码已改”。必须报告真实执行过的命令和未完成的外部验收。
