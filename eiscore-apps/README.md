# EISCore 应用中心模块

> 基于 Cline 逻辑的 AI Agent + BPMN 工作流引擎，面向中小型制造企业的低代码应用平台

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

### 4️⃣ AI Agent Runtime
- 无头 Cline 实现（基于 Claude Sonnet 4）
- 文件操作（读/写/列表）
- 上下文检索（package.json、数据库 schema）
- 安全命令执行（白名单）

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
│ HR子应用│  │物料子应用│  │应用中心 │      │ Agent Runtime│
│ (8082) │  │ (8081) │  │ (8083) │      │   (8078)     │
└────────┘  └────────┘  └────┬───┘      └──────┬───────┘
                             │                  │
                             │  WebSocket       │
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
│   │   │   └── agent-client-examples.js  # Agent API 示例
│   │   └── router/index.js
│   └── package.json
│
├── realtime/                  # ⭐ Agent Runtime 服务（重构）
│   ├── index.js               # WebSocket 服务器 + Agent 集成
│   ├── agent-core.js          # Cline 核心逻辑（Planning & Execution）
│   ├── workflow-engine.js     # BPMN 运行时引擎
│   └── package.json
│
├── sql/
│   └── app_center_schema.sql  # 应用中心数据库 Schema
│
├── docker-compose.yml         # 容器编排（新增 agent-runtime）
├── .env.example               # 环境变量模板
└── APP_CENTER_DEPLOYMENT.md   # 部署文档
```

---

## 🚀 快速开始

### 前置条件
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 16（通过 Docker）
- Anthropic API Key

### 1. 初始化数据库

```bash
# 启动数据库容器
docker-compose up -d db

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

必需配置：
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx  # ⚠️ 必需
POSTGRES_PASSWORD=your_password
PGRST_JWT_SECRET=your_jwt_secret
```

### 3. 启动服务

```bash
# 重建 Agent Runtime 容器
docker-compose build agent-runtime

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f agent-runtime
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
- Agent Runtime：ws://localhost:8078/ws

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

## 🔌 Agent WebSocket API

### 连接

```javascript
const token = localStorage.getItem('auth_token')
const ws = new WebSocket('ws://localhost:8078/ws', ['bearer', token])
```

### 发送任务

```javascript
ws.send(JSON.stringify({
  type: 'agent:task',
  prompt: '创建一个用户列表页面',
  projectPath: 'eiscore-apps'
}))
```

### 接收消息

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch (data.type) {
    case 'agent:status':
      console.log('状态:', data.message)
      break
    case 'agent:file_change':
      console.log('文件变更:', data.data.path)
      break
    case 'agent:result':
      console.log('任务完成:', data.executionLog)
      break
  }
}
```

详细示例见：[eiscore-apps/src/utils/agent-client-examples.js](eiscore-apps/src/utils/agent-client-examples.js)

---

## 🛡️ 安全措施

### AI Agent 隔离
- ✅ 仅能访问 `/workspace` 目录
- ✅ 命令白名单（仅允许 `npm install` 等安全命令）
- ✅ 无直接数据库写入权限

### WebSocket 鉴权
- ✅ 所有连接必须携带 JWT Token
- ✅ Token 通过 `sec-websocket-protocol` 传递
- ✅ 过期 Token 自动拒绝连接

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

### 单元测试（待实施）

```bash
# Agent Core 测试
cd realtime
npm test

# 前端组件测试
cd eiscore-apps
npm run test
```

### 集成测试

```bash
# 启动所有服务
docker-compose up -d

# 测试 Agent 连接
node realtime/test-agent.js

# 测试工作流引擎
node realtime/test-workflow.js
```

---

## 📈 性能优化

### Agent Runtime
- 连接池管理（避免频繁创建 WebSocket）
- 文件操作批处理
- Claude API 调用限流

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

### Agent 不响应

**症状**：WebSocket 连接成功，但发送任务无响应

**排查**：
```bash
# 1. 检查 API Key 配置
docker exec eiscore-agent-runtime printenv | grep ANTHROPIC

# 2. 查看容器日志
docker logs eiscore-agent-runtime --tail=100

# 3. 测试 Claude API 连通性
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
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

**症状**：Agent 报告 "Permission denied"

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
- [Agent API 示例](eiscore-apps/src/utils/agent-client-examples.js)
- [数据库 Schema](sql/app_center_schema.sql)
- [Cline 官方文档](https://github.com/cline/cline)
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
fix(agent-core): 修复文件路径解析错误
docs(readme): 更新部署文档
```

---

## 📄 许可证

UNLICENSED - 内部项目，禁止未授权分发

---

## 👥 联系方式

- 技术支持：查看容器日志或数据库日志
- 功能建议：创建 Issue（如使用 Git 管理）

---

## 🎉 致谢

- [Cline](https://github.com/cline/cline) - AI 编码助手灵感来源
- [Anthropic Claude](https://www.anthropic.com/) - 强大的 AI 引擎
- [qiankun](https://qiankun.umijs.org/) - 微前端框架
- [Element Plus](https://element-plus.org/) - Vue3 UI 组件库
- [PostgREST](https://postgrest.org/) - 数据库 API 生成器

---

**✅ Definition of Done 检查清单**：

- [x] Agent 逻辑与核心业务 UI 完全解耦
- [x] 支持自然语言生成 Vue 组件并实时预览
- [x] BPMN 设计器可保存流程到数据库
- [x] 无任何真实用户信息或公司名称
- [x] 文档完善，部署流程清晰
- [x] 代码遵循 No-Backend 原则（业务逻辑在数据库）
- [x] 使用 Element Plus 主题变量确保 UI 一致性
