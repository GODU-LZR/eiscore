# EISCore 闪念接口语义字段标准（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：闪念应用接口语义建模、Agent 工具注册、接口治理

## 1. 目标

把“接口”变成“AI 可理解语义对象”，用于：
1. 根据自然语言稳定选接口。
2. 限制模型只走允许能力。
3. 统一前后端和文档的语义口径。

## 2. 语义对象结构（标准）

每个接口能力应描述为一个 `semantic_tool`：

```json
{
  "tool_id": "flash.app.publish",
  "tool_name_zh": "发布闪念应用",
  "domain": "flash",
  "intent": "publish",
  "object": "flash_application",
  "summary": "将草稿状态应用发布为可访问路由",
  "api": {
    "path": "/api/apps?id=eq.{appId}",
    "method": "PATCH",
    "profiles": {
      "accept_profile": "app_center",
      "content_profile": "app_center"
    }
  },
  "auth": {
    "requires_login": true,
    "permission_template": "op:{aclModule}.config"
  },
  "risk": {
    "level": "high",
    "side_effect": "writes_data"
  },
  "io_schema": {
    "input": {},
    "output": {}
  },
  "synonyms_zh": ["发布页面", "上线闪念", "生效应用"],
  "tags": ["flash", "publish", "app_center"]
}
```

## 3. 必填字段

1. `tool_id`：唯一标识，建议 `flash.{object}.{action}`
2. `tool_name_zh`：中文名称（面向业务）
3. `intent`：动作意图（如 `read/save/publish/upload/generate`）
4. `object`：目标对象（如 `flash_draft`、`published_route`）
5. `api.path`、`api.method`
6. `auth.requires_login`
7. `risk.level`
8. `io_schema.input`、`io_schema.output`

## 4. 推荐枚举

## 4.1 `intent`

1. `read`
2. `save`
3. `publish`
4. `upload`
5. `generate`
6. `audit`

## 4.2 `object`

1. `flash_draft`
2. `flash_attachment`
3. `flash_application`
4. `published_route`
5. `flash_build_task`
6. `execution_log`

## 4.3 `risk.level`

1. `low`：只读
2. `medium`：保存草稿等中等影响写
3. `high`：发布、路由生效、关键配置覆盖

## 5. 字段语义约束

1. `summary` 必须中文，且可直接给业务人员阅读。
2. `synonyms_zh` 至少 3 个口语别名。
3. `permission_template` 使用模板，不写死具体 app id。
4. `io_schema` 使用 JSON Schema 风格（至少声明 `type/properties/required`）。
5. `risk.level=high` 的工具必须显式标注 `side_effect=writes_data`。

## 6. 与本体/权限的映射关系

1. `domain/object/intent` 对齐本体轻量词汇：
   - `domain=flash`
   - `object=flash_application` 等
2. 权限映射沿用旧体系：
   - `module/app/op/field` 不改
3. 语义只是“能力描述层”，不替代权限裁决层。

## 7. 闪念 V1 推荐语义工具清单

1. `flash.draft.read` -> `GET /agent/flash/draft`
2. `flash.draft.write` -> `POST /agent/flash/draft`
3. `flash.attachment.upload` -> `POST /agent/flash/attachments`
4. `flash.build.run` -> `WS flash:cline_task`
5. `flash.app.read` -> `GET /api/apps?id=eq.{appId}`
6. `flash.app.save` -> `PATCH /api/apps?id=eq.{appId}`
7. `flash.route.upsert` -> `POST/PATCH /api/published_routes`
8. `flash.app.publish` -> `PATCH /api/apps(status=published)`
9. `flash.audit.write` -> `POST /api/execution_logs`

## 8. 机器可读注册表示例

```json
{
  "version": "flash-semantic-schema-v1",
  "domain": "flash",
  "tools": [
    {
      "tool_id": "flash.draft.read",
      "tool_name_zh": "读取闪念草稿",
      "intent": "read",
      "object": "flash_draft",
      "api": { "path": "/agent/flash/draft", "method": "GET" },
      "auth": { "requires_login": true, "permission_template": "app:{aclModule}" },
      "risk": { "level": "low", "side_effect": "none" },
      "io_schema": {
        "input": { "type": "object", "properties": {}, "required": [] },
        "output": {
          "type": "object",
          "properties": {
            "content": { "type": "string" }
          },
          "required": ["content"]
        }
      },
      "synonyms_zh": ["打开草稿", "读取页面草稿", "查看当前代码"],
      "tags": ["flash", "draft", "read"]
    }
  ]
}
```

## 9. 版本策略

1. `v1.x`：新增工具、补充别名、扩展 schema 字段（向后兼容）
2. `v2.0`：字段破坏性调整（需迁移）

## 10. 验收口径

1. 同一用户请求在 3 次测试中命中同一 `tool_id`。
2. 高风险工具不得被低风险意图误选。
3. 工具入参缺字段时能触发明确追问，而不是盲调接口。
