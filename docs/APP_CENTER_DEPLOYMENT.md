# 应用中心模块部署指南

## 📋 模块概述

本模块集成了：
1. **AI Agent Runtime** - 基于 Cline 逻辑的无头 AI 编码代理
2. **Flash Builder** - 生成式 UI 构建器（对话式创建应用）
3. **BPMN 工作流引擎** - 可视化流程设计 + 自动化状态管理
4. **数据应用配置** - 快速创建 CRUD 表格应用

---

## 🛠️ 部署步骤

### 1. 创建数据库 Schema

```bash
# 进入数据库容器
docker exec -it eiscore-db psql -U postgres -d eiscore

# 创建 app_center schema
CREATE SCHEMA IF NOT EXISTS app_center;

# 执行 SQL 脚本
\i /path/to/sql/app_center_schema.sql
```

或通过主机直接导入：
```bash
psql -h localhost -U postgres -d eiscore -f sql/app_center_schema.sql
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 数据库密码
POSTGRES_PASSWORD=your_secure_password

# JWT 密钥（用于 PostgREST）
PGRST_JWT_SECRET=your_jwt_secret_key

# Anthropic API Key（必需）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx

# CORS 白名单（开发环境）
VITE_DEV_CORS_ORIGIN=http://localhost:8080
```

⚠️ **重要**：`ANTHROPIC_API_KEY` 必须配置，否则 AI Agent 功能无法使用。

### 3. 重建 Agent Runtime 容器

```bash
# 停止旧容器
docker-compose down

# 重建镜像（realtime 已改名为 agent-runtime）
docker-compose build agent-runtime

# 启动所有服务
docker-compose up -d
```

### 4. 安装前端依赖

```bash
# eiscore-apps 子应用
cd eiscore-apps
npm install

# 启动开发服务器
npm run dev
```

### 5. 在基座应用中测试路由

访问 `http://localhost:8080/apps`，应能看到应用中心首页。

---

## 🧪 功能测试

### Flash Builder（AI 生成应用）

1. 进入应用中心 `/apps`
2. 点击"创建应用" -> 选择 "⚡ Flash App"
3. 输入应用名称，如"客户联系表单"
4. 进入 FlashBuilder 界面
5. 在聊天框输入：
   ```
   创建一个客户联系表单，包含姓名、电话、邮箱、留言四个字段，使用 Element Plus 组件
   ```
6. AI Agent 会自动生成 Vue 组件文件
7. 右侧 iframe 实时显示预览

### 工作流设计器（BPMN）

1. 创建应用 -> 选择 "🔀 Workflow App"
2. 进入设计器（需安装 `bpmn-js` 库）
3. 绘制流程图（示例：请假审批流程）
4. 在属性面板配置状态映射：
   - 任务节点：`Task_ManagerApproval`
   - 目标表：`hr.leave_requests`
   - 状态字段：`approval_status`
   - 状态值：`PENDING_MANAGER`
5. 保存并发布

### 数据应用（配置式 CRUD）

1. 创建应用 -> 选择 "📊 Data App"
2. 配置：
   - 数据表：`hr.employees`
   - 主键：`id`
   - 显示列：`["name", "email", "department"]`
3. 保存后可嵌入主应用

---

## 🔌 WebSocket API 使用

### 连接 Agent

```javascript
const token = localStorage.getItem('auth_token')
const ws = new WebSocket('ws://localhost:8078/ws', ['bearer', token])

ws.onopen = () => {
  // 发送任务
  ws.send(JSON.stringify({
    type: 'agent:task',
    prompt: '创建一个用户登录页面',
    projectPath: 'eiscore-apps'
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  if (data.type === 'agent:status') {
    console.log('状态:', data.message)
  }
  
  if (data.type === 'agent:file_change') {
    console.log('文件变更:', data.data.path)
  }
  
  if (data.type === 'agent:result') {
    console.log('任务完成:', data.executionLog)
  }
}
```

### 触发工作流任务

```javascript
// 通过 API 插入待执行任务
const response = await axios.post('/api/app_center.execution_logs', {
  app_id: 'workflow-uuid-here',
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

## 🚨 常见问题

### 1. AI Agent 不工作

- 检查 `ANTHROPIC_API_KEY` 是否正确配置
- 查看容器日志：`docker logs eiscore-agent-runtime`
- 确认 Claude Sonnet 4 模型可访问

### 2. 文件写入失败

- 确认 Docker Volume 挂载正确：
  ```yaml
  volumes:
    - ./eiscore-apps:/workspace/eiscore-apps
  ```
- 检查容器内文件权限

### 3. iframe 预览白屏

- 检查 Vite HMR 是否启动（端口 8083）
- 确认路由配置正确：`/__preview/:draftId`
- 查看浏览器控制台错误

### 4. 工作流不执行

- 确认 workflow_engine 已初始化（查看启动日志）
- 检查 `execution_logs` 表中任务状态
- 确认 RLS 策略允许当前用户访问

---

## 📚 架构说明

### 目录结构

```
eiscore/
├── eiscore-apps/              # 应用中心子应用
│   ├── src/
│   │   ├── views/
│   │   │   ├── AppDashboard.vue      # 首页
│   │   │   ├── FlashBuilder.vue      # AI 构建器
│   │   │   ├── WorkflowDesigner.vue  # BPMN 设计器
│   │   │   └── DataApp.vue           # 数据应用配置
│   │   └── router/
│   └── package.json
│
├── realtime/                 # Agent Runtime 服务
│   ├── index.js              # WebSocket 服务器 + Agent 集成
│   ├── agent-core.js         # Cline 核心逻辑
│   ├── workflow-engine.js    # BPMN 运行时引擎
│   └── package.json
│
├── sql/
│   └── app_center_schema.sql # 数据库 Schema
│
└── docker-compose.yml        # 容器编排配置
```

### 数据流

1. **Flash Builder**:
   ```
   用户输入 -> WebSocket -> AI Agent -> 写文件 -> Vite HMR -> iframe 刷新
   ```

2. **Workflow Engine**:
   ```
   任务插入 -> Poller 检测 -> 执行状态迁移 -> 更新数据库 -> NOTIFY
   ```

3. **数据应用**:
   ```
   配置 JSON -> PostgREST API -> 动态表格渲染
   ```

---

## 🔐 安全注意事项

1. **AI Agent 权限隔离**：
   - Agent 只能访问 `/workspace` 目录
   - 命令执行白名单限制（仅 `npm install` 等安全命令）

2. **工作流执行权限**：
   - 通过 RLS 确保用户只能触发自己权限范围内的任务
   - 状态迁移前验证用户角色

3. **WebSocket 鉴权**：
   - 所有连接必须携带 JWT Token
   - Token 通过 `sec-websocket-protocol` 头传递

---

## 📈 未来扩展

- [ ] Monaco Editor 深度集成（实时语法高亮）
- [ ] BPMN 可视化库实际集成（目前为占位符）
- [ ] 工作流引擎支持条件分支和并行网关
- [ ] Flash App 支持多文件项目（目前仅单文件组件）
- [ ] 数据应用支持复杂查询构建器
- [ ] Agent 支持更多工具（Git 操作、测试运行等）

---

## 📞 技术支持

如遇问题，请检查：
1. 容器日志：`docker-compose logs -f agent-runtime`
2. 数据库连接：`docker exec -it eiscore-db psql -U postgres -d eiscore`
3. 前端控制台（F12）

---

**定义完成标准**：

✅ Agent 逻辑与核心业务 UI 完全解耦  
✅ 用户可通过自然语言生成 Vue 组件并实时预览  
✅ BPMN 设计器可保存流程定义到数据库  
✅ 代码库无任何真实用户信息或公司名称  

**下一步**：
1. 安装 `bpmn-js` 到 `eiscore-apps` 项目
2. 配置 Anthropic API Key
3. 测试完整的 Flash App 生成流程
