# EISCore 闪念应用接口目录（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：FlashBuilder、agent-runtime、应用中心发布链路

## 1. 目标

本目录用于给 AI 定制闪念应用提供“可调用接口白名单”，避免模型自由拼接未知接口。

## 2. 模块边界

1. 闪念前端：`eiscore-apps/src/views/FlashBuilder.vue`
2. Agent 运行时：`realtime/index.js`
3. 应用中心数据面：`app_center.apps`、`app_center.published_routes`、`app_center.execution_logs`

## 3. 鉴权与请求头

1. `Authorization: Bearer <token>`（必需）
2. 应用中心接口建议带：
   - `Accept-Profile: app_center`
   - `Content-Profile: app_center`
3. JSON 写操作建议：
   - `Content-Type: application/json`

## 4. HTTP 接口清单

## 4.1 Agent Runtime（闪念相关）

| 接口 | 方法 | 说明 | 典型调用位置 |
|---|---|---|---|
| `/agent/health` | GET | Agent 健康检查 | 运维/探活 |
| `/agent/flash/draft` | GET | 读取远端草稿源码 | `FlashBuilder.vue` |
| `/agent/flash/draft` | POST | 写入远端草稿源码 | `FlashBuilder.vue` |
| `/agent/flash/attachments` | POST | 上传附件供 AI 使用 | `FlashBuilder.vue` |

`POST /agent/flash/draft` 最小请求体：
```json
{
  "content": "<template>...</template>",
  "reason": "restore_app_draft"
}
```

`POST /agent/flash/attachments` 最小请求体：
```json
{
  "appId": "app_uuid_or_default",
  "conversationId": "session_id",
  "fileName": "需求说明.docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "contentBase64": "..."
}
```

## 4.2 应用中心（闪念生命周期）

| 接口 | 方法 | 说明 | 典型调用位置 |
|---|---|---|---|
| `/api/apps?id=eq.{appId}&limit=1` | GET | 读取闪念应用配置与源码 | `FlashBuilder.vue` |
| `/api/apps?id=eq.{appId}` | PATCH | 保存草稿配置/源码 | `FlashBuilder.vue` |
| `/api/apps?id=eq.{appId}` | PATCH | 发布应用（`status=published`） | `FlashBuilder.vue` |
| `/api/published_routes?app_id=eq.{appId}&order=id.desc&limit=1` | GET | 查询发布路由 | `FlashBuilder.vue` |
| `/api/published_routes?id=eq.{rowId}` | PATCH | 更新发布路由 | `FlashBuilder.vue` |
| `/api/published_routes` | POST | 创建发布路由 | `FlashBuilder.vue` |
| `/api/execution_logs` | POST | 写入闪念操作审计（best-effort） | `FlashBuilder.vue` |

## 5. WebSocket 接口清单（`/agent/ws`）

连接：
1. URL：`ws(s)://{host}/agent/ws`
2. 子协议携带 token（与当前实现一致）

## 5.1 Client -> Server 事件

1. `flash:cline_task`
```json
{
  "type": "flash:cline_task",
  "sessionId": "flash_shell_xxx",
  "prompt": "请按附件生成页面",
  "history": [{"role":"user","content":"..."}],
  "attachments": [
    {
      "id": "att_xxx",
      "name": "spec.md",
      "mimeType": "text/markdown",
      "size": 1024,
      "relativePath": ".uploads/app/default/spec.md",
      "textPreview": "..."
    }
  ],
  "model": "glm-4.6v"
}
```

2. `flash:cline_stop`
```json
{
  "type": "flash:cline_stop",
  "sessionId": "flash_shell_xxx"
}
```

3. `flash:cline_reset`
```json
{
  "type": "flash:cline_reset",
  "sessionId": "flash_shell_xxx"
}
```

## 5.2 Server -> Client 事件

1. `flash:cline_status`（running/retry/reset/stopped/log）
2. `flash:cline_output`（流式正文片段）
3. `flash:cline_summary`（总结输出）
4. `flash:cline_error`（错误）
5. `flash:cline_done`（任务结束，含 success/exitCode/elapsedMs）

## 6. 最小执行链路（闪念定制）

1. 读取应用：`GET /api/apps`
2. 同步草稿：`GET/POST /agent/flash/draft`
3. 上传附件：`POST /agent/flash/attachments`
4. AI 加工：`WS flash:cline_task`
5. 保存：`PATCH /api/apps`
6. 发布：`PATCH /api/apps(status)` + `upsert /api/published_routes`
7. 审计：`POST /api/execution_logs`

## 7. 约束

1. 只允许目录内白名单接口被 Agent 编排调用。
2. 新增接口需先补本文件，再开放给 Agent。
3. 当前阶段优先保证“生成与发布链路”可用，不扩展虚拟员工自动执行链。
