# EISCore 闪念 Agent 工具调用协议（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：FlashBuilder 与 Agent Runtime 的工具调用与回传

## 1. 目标

定义一套统一的“工具调用请求/响应协议”，让：
1. 模型调用可控（只调已注册工具）
2. 前端渲染可预测（结构稳定）
3. 审计可串联（trace/idempotency）

## 2. 协议分层

1. `Tool Registry`：可调用工具目录（语义层）。
2. `Tool Call`：单次调用请求/响应（执行层）。
3. `Event Stream`：长任务流式事件（WS 层）。

## 3. Tool Registry 结构

```json
{
  "registry_version": "flash-tools-v1",
  "domain": "flash",
  "tools": [
    {
      "tool_id": "flash.draft.read",
      "tool_name_zh": "读取闪念草稿",
      "intent": "read",
      "object": "flash_draft",
      "risk_level": "low",
      "api": { "path": "/agent/flash/draft", "method": "GET" }
    }
  ]
}
```

## 4. Tool Call 请求协议

```json
{
  "trace_id": "tr_20260219_xxx",
  "idempotency_key": "idem_20260219_xxx",
  "session_id": "flash_shell_xxx",
  "app_id": "uuid_or_default",
  "tool_id": "flash.draft.write",
  "intent": "save",
  "object": "flash_draft",
  "arguments": {
    "content": "<template>...</template>",
    "reason": "restore_app_draft"
  },
  "context": {
    "mode": "code_server",
    "user_role": "super_admin"
  }
}
```

字段要求：
1. `trace_id`：必填，跨服务追踪。
2. `idempotency_key`：写操作必填，防重复。
3. `tool_id`：必须存在于 Registry。
4. `arguments`：必须满足该工具 input schema。

## 5. Tool Call 响应协议

```json
{
  "ok": true,
  "code": "OK",
  "message": "草稿已保存",
  "tool_id": "flash.draft.write",
  "trace_id": "tr_20260219_xxx",
  "data": {
    "path": "eiscore-apps/src/views/drafts/FlashDraft.vue",
    "bytes": 2048
  },
  "meta": {
    "risk_level": "medium",
    "duration_ms": 148,
    "rows_affected": 1
  }
}
```

失败响应：
```json
{
  "ok": false,
  "code": "PERMISSION_DENIED",
  "message": "当前角色无权限执行该工具",
  "tool_id": "flash.app.publish",
  "trace_id": "tr_20260219_xxx",
  "error": {
    "reason_code": "PERMISSION_DENIED",
    "http_status": 403
  }
}
```

## 6. 错误码标准（V1）

1. `OK`
2. `BAD_REQUEST`
3. `VALIDATION_FAILED`
4. `TOOL_NOT_FOUND`
5. `PERMISSION_DENIED`
6. `RLS_DENIED`
7. `CONFLICT`
8. `TIMEOUT`
9. `UPSTREAM_ERROR`
10. `INTERNAL_ERROR`

## 7. WebSocket 长任务协议（`/agent/ws`）

## 7.1 Client -> Server

`flash:cline_task`
```json
{
  "type": "flash:cline_task",
  "sessionId": "flash_shell_xxx",
  "prompt": "根据附件生成请假申请页面",
  "history": [{"role":"user","content":"..."}],
  "attachments": [
    {
      "name": "spec.md",
      "mimeType": "text/markdown",
      "size": 1024,
      "relativePath": ".uploads/app/default/spec.md",
      "textPreview": "..."
    }
  ]
}
```

`flash:cline_stop`
```json
{
  "type": "flash:cline_stop",
  "sessionId": "flash_shell_xxx"
}
```

`flash:cline_reset`
```json
{
  "type": "flash:cline_reset",
  "sessionId": "flash_shell_xxx"
}
```

## 7.2 Server -> Client

1. `flash:cline_status`
2. `flash:cline_output`
3. `flash:cline_summary`
4. `flash:cline_error`
5. `flash:cline_done`

`flash:cline_done` 示例：
```json
{
  "type": "flash:cline_done",
  "sessionId": "flash_shell_xxx",
  "success": true,
  "exitCode": 0,
  "elapsedMs": 9234
}
```

## 8. 安全约束

1. 工具必须白名单注册后才可调用。
2. 写操作必须带 `idempotency_key`。
3. 所有调用必须带 `trace_id`。
4. 附件路径只能是受控相对路径，禁止路径逃逸。

## 9. 与当前实现的对齐

当前已具备：
1. HTTP：`/agent/flash/draft`、`/agent/flash/attachments`
2. WS：`flash:cline_task/stop/reset` 与回传事件
3. 应用发布：`/api/apps` + `/api/published_routes`
4. 审计写入：`/api/execution_logs`

本协议用于统一这些能力的语义调用方式，不要求立即改造全部后端结构。

## 10. 最小上线步骤

1. 先固化 Registry（只放 8~10 个闪念核心工具）。
2. 前端调用统一封装到 Tool Call 请求结构。
3. 失败按标准错误码回传。
4. 观测 `trace_id` 全链路可追踪后再扩工具。
