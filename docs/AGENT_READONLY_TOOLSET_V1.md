# EISCore Agent 首批只读工具清单（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：闪念应用、应用中心、本体工作台的 Agent 只读能力开通

## 1. 目标

在不改动你现有权限核心的前提下，先上线 10 个低风险只读工具，形成稳定的查询闭环。

约束：
1. 全部 `risk=low`
2. 全部 `confirm_required=false`
3. 全部遵守现有 `module/app/op/field` 权限判定

## 2. 首批 10 个工具（建议直接注册）

| tool_id | 中文名 | 接口 | method | 最低权限 | 场景 |
|---|---|---|---|---|---|
| `cap.app.list` | 查询应用列表 | `/api/apps` | GET | `module:app` | 查看应用中心所有应用 |
| `cap.app.detail` | 查询应用详情 | `/api/apps?id=eq.{appId}` | GET | `app:{aclModule}` | 查看单个应用配置 |
| `cap.route.resolve` | 查询发布路由 | `/api/published_routes?route_path=eq.{path}` | GET | `module:app` | 判断访问路径归属 |
| `cap.data.grid.list` | 查询表格列表数据 | `/api/{table}` | GET | `app:{aclModule}` | 通用表格列表查询 |
| `cap.data.grid.detail` | 查询表格单条详情 | `/api/{table}?id=eq.{id}` | GET | `app:{aclModule}` | 详情查看 |
| `cap.workflow.definition.list` | 查询流程定义 | `/api/definitions?app_id=eq.{appId}` | GET | `app:{aclModule}` | 查看流程模板 |
| `cap.workflow.instance.list` | 查询流程实例 | `/api/instances?definition_id=eq.{id}` | GET | `app:{aclModule}` | 查看流程进度列表 |
| `cap.workflow.event.list` | 查询流程日志 | `/api/instance_events?...` | GET | `app:{aclModule}` | 查看实例轨迹 |
| `cap.inventory.current.list` | 查询当前库存 | `/api/v_inventory_current` | GET | `app:mms_ledger` | 库存现状查询 |
| `cap.ontology.relation.list` | 查询本体关系 | `/api/ontology_table_relations?relation_type=eq.ontology` | GET | `app:ontology_workbench` | 本体关系查看 |

## 3. 注册模板（机器可读）

```json
{
  "registry_version": "readonly-tools-v1",
  "tools": [
    { "tool_id": "cap.app.list", "intent": "read_list", "object": "app_registry", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.app.detail", "intent": "read_detail", "object": "app_registry", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.route.resolve", "intent": "read_detail", "object": "app_registry", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.data.grid.list", "intent": "read_list", "object": "data_table", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.data.grid.detail", "intent": "read_detail", "object": "data_table", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.workflow.definition.list", "intent": "read_list", "object": "workflow_definition", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.workflow.instance.list", "intent": "read_list", "object": "workflow_instance", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.workflow.event.list", "intent": "read_list", "object": "workflow_instance", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.inventory.current.list", "intent": "read_list", "object": "inventory_current", "risk": "low", "confirm_required": false },
    { "tool_id": "cap.ontology.relation.list", "intent": "read_list", "object": "ontology_relation", "risk": "low", "confirm_required": false }
  ]
}
```

## 4. 上线顺序（建议）

1. 第 1 组：`cap.app.list`、`cap.app.detail`、`cap.route.resolve`
2. 第 2 组：`cap.data.grid.list`、`cap.data.grid.detail`
3. 第 3 组：`cap.workflow.definition.list`、`cap.workflow.instance.list`、`cap.workflow.event.list`
4. 第 4 组：`cap.inventory.current.list`、`cap.ontology.relation.list`

## 5. 验收口径

1. 用户同一问法 3 次命中同一工具。
2. 无写接口被误调用。
3. 权限拒绝时返回 403/权限错误而不是空结果。
4. 审计日志能定位 `trace_id -> tool_id -> api`。

