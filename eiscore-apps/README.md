# EISCore 应用中心模块

> Harness-only 说明：旧模型直连、遗留任务协议和直接模型 API 配置均已移除。AI 能力统一通过 DeepSeek Harness 插件、EISCore Gateway 与权限化业务工具执行。

> 面向制造企业的低代码应用平台，AI 能力通过 DeepSeek Harness 插件与 EISCore Tool Gateway 提供

---

## 🎯 核心功能

### 1️⃣ Flash Builder（AI 生成式应用）
- 对话式创建 Vue 组件
- 实时代码预览（iframe + HMR）
- 自动文件写入和依赖管理
- Monaco Editor 代码编辑（可选）

### 2️⃣ BPMN 工作流设计器
- 可视化流程设计
- 状态映射（User Task → 数据库字段）
- 自动化状态迁移
- 执行日志跟踪

### 3️⃣ 数据应用配置
- 快速配置 CRUD 表格
- 基于 PostgREST 的动态查询
- 列级权限集成
- 表单验证配置

### 4️⃣ Harness 能力入口
- DeepSeek Harness 插件调用 EISCore Gateway
- Flash、Workflow、数字分身和查询能力按用户权限暴露
- 写操作由服务端确认、幂等和审计边界保护

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                     EISCore 基座应用 (8080)                      │
│                    qiankun Micro-frontend Host                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬─────────────────┐
    │            │            │                 │
    ▼            ▼            ▼                 ▼
┌────────┐  ┌────────┐  ┌────────┐      ┌──────────────┐
│ HR子应用│  │物料子应用│  │应用中心 │      │ Harness Bridge│
│ (8082) │  │ (8081) │  │ (8083) │      │   (3080)      │
└────────┘  └────────┘  └────┬───┘      └──────┬───────┘
                             │                  │
                             │  Harness HTTP    │
                             ├──────────────────┤
                             │                  │
                        ┌────▼──────────────────▼────┐
                        │                            │
                        │   PostgreSQL (5432)        │
                        │   + PostgREST API (3000)   │
                        │                            │
                        └────────────────────────────┘
```

---

## 📂 目录结构

```
eiscore/
├── eiscore-base/              # 基座应用（主 Shell）
│   └── src/micro/apps.js      # qiankun 子应用注册
│
├── eiscore-hr/                # 人事管理子应用
├── eiscore-materials/         # 物料管理子应用
│
├── eiscore-apps/               # ⭐ 应用中心子应用（新增）
│   ├── src/
│   │   ├── views/
│   │   │   ├── AppDashboard.vue      # 应用中心首页
│   │   │   ├── FlashBuilder.vue      # AI 构建器
│   │   │   ├── WorkflowDesigner.vue  # BPMN 设计器
│   │   │   ├── DataApp.vue           # 数据应用配置
│   │   │   └── PreviewFrame.vue      # 预览框架
│   │   ├── utils/
│   │   │   └── flash-agent-client.js     # Flash Harness 客户端
│   │   └── router/index.js
│   └── package.json
│
├── realtime/                  # ⭐ EISCore Harness Gateway 服务
│   ├── index.js               # HTTP/WebSocket 组合根
│   ├── harness-runtime.js     # Harness Bridge 与本地 Tool Gateway
│   ├── workflow-engine.js     # BPMN 运行时引擎
│   └── package.json
│
├── sql/
│   └── app_center_schema.sql  # 应用中心数据库 Schema
│
├── docker-compose.yml         # 容器编排（runtime + Harness Bridge）
├── .env.example               # 环境变量模板
└── APP_CENTER_DEPLOYMENT.md   # 部署文档
```

---

## 🚀 快速开始

### 前置条件
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 16（通过 Docker）
- DeepSeek Harness Bridge（本地开发可使用 mock）

### 1. 初始化数据库

```bash
# 启动数据库容器
docker compose up -d db

# 导入应用中心 Schema
docker exec -i eiscore-db psql -U postgres -d eiscore < sql/app_center_schema.sql
```

### 2. 配置环境变量

```bash
# 复制模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

Harness 配置：
```env
EISCORE_HARNESS_ENABLED=true
EISCORE_HARNESS_URL=http://harness-bridge:3080
EISCORE_HARNESS_AUDIT_FILE=/var/lib/eiscore/harness-audit.jsonl
EISCORE_HARNESS_AUDIT_HASH_KEY=replace-with-a-random-secret-at-least-32-chars
EISCORE_TOOL_PROXY_SECRET=replace-with-a-random-tool-proxy-secret
DSH_PROVIDER=deepseek-official
DSH_MODEL=deepseek-v4-flash
POSTGRES_PASSWORD=your_password
PGRST_JWT_SECRET=your_jwt_secret
```

### 3. 启动服务

```bash
# 重建 EISCore runtime 与 Harness Bridge 容器
docker compose build agent-runtime harness-bridge

# 仅启动本地验收所需的明确服务；不要使用无范围的 compose up
docker compose up -d db api agent-runtime harness-bridge

# 查看日志
docker compose logs -f agent-runtime harness-bridge
```

### 4. 启动前端子应用

```bash
# 基座应用
cd eiscore-base
npm install
npm run dev  # 端口 8080

# 应用中心
cd eiscore-apps
npm install
npm run dev  # 端口 8083
```

### 5. 访问应用

- 基座应用：http://localhost:8080
- 应用中心：http://localhost:8080/apps
- PostgREST API：http://localhost:3000
- Harness Bridge：http://localhost:3080

---

## 💡 使用示例

### 创建一个 Flash App

1. 访问 http://localhost:8080/apps
2. 点击"创建应用" → 选择 "⚡ Flash App"
3. 输入应用名称："客户反馈表单"
4. 进入 FlashBuilder
5. 在聊天框输入：

```
创建一个客户反馈表单，包含：
- 客户姓名（必填）
- 联系邮箱（必填，邮箱格式验证）
- 产品名称（下拉选择：产品A、产品B、产品C）
- 满意度评分（1-5星）
- 反馈内容（多行文本）
- 提交按钮（调用 POST /api/feedback 接口）
- 使用 Element Plus 组件
- 添加成功/失败提示
```

6. AI Agent 自动生成代码
7. 右侧实时预览

### 设计一个审批工作流

1. 创建应用 → 选择 "🔀 Workflow App"
2. 进入 WorkflowDesigner
3. 绘制流程（示例：请假审批）：
   ```
   开始 → 提交申请 → 部门经理审批 → HR审核 → 结束
   ```
4. 配置任务节点属性：
   - 任务：部门经理审批
   - 目标表：`hr.leave_requests`
   - 状态字段：`approval_status`
   - 状态值：`PENDING_MANAGER`
5. 保存并发布

### 触发工作流执行

```javascript
// 插入待执行任务
await axios.post('/api/app_center.execution_logs', {
  app_id: 'workflow-uuid',
  task_id: 'Task_ManagerApproval',
  status: 'pending',
  input_data: { record_id: 123 },
  executed_by: currentUserId
}, {
  headers: { Authorization: `Bearer ${token}` }
})

// 工作流引擎会在 5 秒内自动执行
```

---

## 🔌 Harness 能力调用

前端请求通过基座的 `/ai/chat/completions`、`/ai/harness/execute` 和 `/flash/tools/call` 入口进入 Harness Gateway。客户端不得提交 JWT、tenant、SQL、任意表名或数据库 URL；服务端从认证会话取得这些上下文。

写能力必须同时满足服务端权限、`confirmed=true`、16-128 字符幂等键和可持久化审计；Harness 不可用时返回稳定错误，不回退到旧模型。

---

## 🛡️ 安全措施

### Harness 隔离
- ✅ 插件不能直连数据库或提交 SQL
- ✅ 查询数据集、字段和 PostgREST profile 由服务端固定
- ✅ 写操作受权限、确认、幂等和审计保护

### 工作流权限
- ✅ 基于 RLS（Row Level Security）
- ✅ 用户只能触发自己权限范围内的任务
- ✅ 执行日志记录所有操作

### 数据隔离
- ✅ 应用草稿仅创建者可见
- ✅ 已发布应用所有用户可访问
- ✅ 敏感配置不暴露到前端

---

## 🧪 测试

### Harness 契约测试

```bash
# Harness 后端、权限、确认、幂等、审计和生产路径
npm run test:harness
npm run test:production-config
npm run test:runtime-image

# 前端组件测试
cd eiscore-apps
npm run test
```

### 集成测试

```bash
# 只启动隔离验收需要的明确后端服务
docker compose up -d db api agent-runtime harness-bridge

# 测试 Harness 入口
npm run test:harness

# 测试工作流引擎
node realtime/test-workflow.js
```

---

## 📈 性能优化

### Harness Runtime
- Bridge 会话与并发容量限制
- 能力级超时和请求重放保护
- PostgREST/RPC 调用沿用认证用户的 RLS 上下文

### 工作流引擎
- 任务轮询间隔可配置（默认 5 秒）
- 批量执行待处理任务
- 执行日志定期归档

### 前端优化
- iframe 预览懒加载
- Monaco Editor 按需加载
- BPMN 渲染虚拟化

---

## 🐛 故障排查

### Harness 不响应

**症状**：Harness 请求没有返回结果

**排查**：
```bash
# 1. 检查 Harness 配置
docker compose config --quiet

# 2. 查看容器日志
docker compose logs --tail=100 agent-runtime deepseek-web

# 3. 测试 Harness Bridge 健康状态
curl http://localhost:3080/readyz
```

### 工作流不执行

**症状**：任务一直处于 `pending` 状态

**排查**：
```sql
-- 检查任务状态
SELECT * FROM app_center.execution_logs 
WHERE status = 'pending' 
ORDER BY executed_at DESC;

-- 检查工作流配置
SELECT * FROM app_center.apps 
WHERE app_type = 'workflow' AND status = 'published';

-- 检查状态映射
SELECT * FROM app_center.workflow_state_mappings;
```

### 文件写入失败

**症状**：Harness 工具报告权限拒绝

**排查**：
```bash
# 检查 Volume 挂载
docker inspect eiscore-agent-runtime | grep Mounts -A 20

# 检查容器内权限
docker exec eiscore-agent-runtime ls -la /workspace/eiscore-apps
```

---

## 📚 相关文档

- [部署指南](APP_CENTER_DEPLOYMENT.md)
- [Harness 客户端示例](eiscore-apps/src/utils/agent-client-examples.js)
- [数据库 Schema](sql/app_center_schema.sql)
- [PostgREST 文档](https://postgrest.org/)

---

## 🤝 贡献指南

### 开发分支策略
- `main`: 稳定版本
- `dev`: 开发分支
- `feature/*`: 新功能分支

### 代码规范
- Vue3 Composition API
- ESLint + Prettier
- 命名规范：
  - 组件：PascalCase
  - 工具函数：camelCase
  - 常量：UPPER_SNAKE_CASE

### 提交规范
```
<type>(<scope>): <subject>

Types:
- feat: 新功能
- fix: 修复 Bug
- docs: 文档更新
- refactor: 重构
- test: 测试
- chore: 构建/依赖更新

Examples:
feat(flash-builder): 添加 Monaco Editor 集成
fix(harness): 修复 capability 路径解析错误
docs(readme): 更新部署文档
```

---

## 📄 License

This subproject is part of EISCore and is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later), consistent with the root LICENSE file.

Copyright (c) 2026 林志荣.

Commercial, proprietary, government product declaration, software copyright registration, customer delivery, SaaS/private deployment, or closed-source use that does not fully comply with AGPL-3.0-or-later requires separate written authorization from the copyright holder. See the root NOTICE, COPYRIGHT.md, and COMMERCIAL-LICENSE.md for details.

---

## 👥 联系方式

- 技术支持：查看容器日志或数据库日志
- 功能建议：创建 Issue（如使用 Git 管理）

---

## 🎉 致谢

- [DeepSeek Harness](../docs/engineering/DEEPSEEK_HARNESS_BACKEND_MIGRATION_STATUS.md) - Harness 插件与后端迁移状态
- [qiankun](https://qiankun.umijs.org/) - 微前端框架
- [Element Plus](https://element-plus.org/) - Vue3 UI 组件库
- [PostgREST](https://postgrest.org/) - 数据库 API 生成器

---

**✅ Definition of Done 检查清单**：

- [x] Harness 能力与核心业务 UI 完全解耦
- [x] 支持自然语言生成 Vue 组件并实时预览
- [x] BPMN 设计器可保存流程到数据库
- [x] 无任何真实用户信息或公司名称
- [x] 文档完善，部署流程清晰
- [x] 业务访问通过 Harness Gateway、Tool Gateway、PostgREST/RLS 边界执行
- [x] 使用 Element Plus 主题变量确保 UI 一致性
