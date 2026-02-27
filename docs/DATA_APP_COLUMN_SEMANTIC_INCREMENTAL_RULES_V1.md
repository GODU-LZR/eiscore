# EISCore 表格应用新增列语义增量规则（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：应用中心数据应用（`DataApp.vue`）新增列/改列后的语义自动补全

## 1. 目标

当用户在表格应用中新增列时，系统自动增量补语义，用户无感，不影响现有权限链路。

不变约束：
1. 不改 `module/app/op/field` 现有权限模型。
2. 语义补全失败不阻断列生效。
3. 兼容模式优先（`permission_mode=compat`）。

## 2. 当前输入结构（已落地）

数据应用列输入来自 `config.columns`，单列结构：

```json
{
  "field": "employee_name",
  "label": "员工姓名",
  "type": "text"
}
```

列类型来自 `eiscore-apps/src/utils/data-app-columns.js`：
1. `text`
2. `select`
3. `cascader`
4. `geo`
5. `file`
6. `formula`

## 3. 触发时机（增量）

1. 用户点击保存配置（`saveConfig`）后，对比“旧列集合 vs 新列集合”。
2. 用户点击发布（`publishApp`）后，进行一次补偿式增量检查。

只处理变化列：
1. 新增列：`field` 新出现
2. 变更列：`label/type` 变化
3. 删除列：旧列存在、新列不存在

## 4. 语义生成规则

## 4.1 通用规则

1. 规范化字段名：小写 + 下划线（沿用现有建表清洗规则）。
2. `semantic_name` 优先用 `label`，缺失时回退 `field`。
3. `semantic_description` 使用模板：`{app_name} 的字段“{semantic_name}”`。
4. `source` 标记为 `agent`，失败回退标记为 `rule_fallback`。

## 4.2 按列类型映射语义类

| 列类型 | semantic_class | tags 建议 | 说明 |
|---|---|---|---|
| `text` | `business_attribute` | `["basic"]` | 普通业务属性 |
| `select` | `enum_attribute` | `["enum","option"]` | 枚举值字段 |
| `cascader` | `hierarchy_attribute` | `["hierarchy","tree"]` | 层级联动字段 |
| `geo` | `geo_attribute` | `["geo","location"]` | 地理位置字段 |
| `file` | `file_attribute` | `["file","attachment"]` | 附件类字段 |
| `formula` | `derived_metric` | `["derived","formula"]` | 派生计算字段 |

## 4.3 删除列规则

1. 不做硬删除。
2. 将对应列语义标记为 `is_active=false`。
3. 保留历史审计，便于回滚追踪。

## 5. 增量算法（建议）

## 5.1 幂等键

`idempotency_key = app_id + ":" + table_name + ":" + field + ":" + semantic_version`

## 5.2 差异计算

1. `old_map[field]`、`new_map[field]`
2. 若 `field not in old_map` -> `insert`
3. 若 `field in both` 且 `label/type` 变化 -> `upsert`
4. 若 `field not in new_map` -> `deactivate`

## 6. 输出结构（示例）

```json
{
  "app_id": "8f8d4f5f-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "table_schema": "app_data",
  "table_name": "data_app_8f8d4f5f",
  "field": "employee_name",
  "semantic_mode": "ai_defined",
  "semantic_class": "business_attribute",
  "semantic_name": "员工姓名",
  "semantic_description": "入职流程台账 的字段“员工姓名”",
  "tags": ["basic"],
  "source": "agent",
  "is_active": true
}
```

## 7. 与本体工作台对接建议

1. 工作台默认展示“表关系”不变。
2. 新增一个“列语义”视图（分页加载），来源于列语义表/视图。
3. 若暂不改前端，可先在“关系详情”区域增加列语义摘要计数。

## 8. 审计事件（最小集）

1. `semantic.column.enrich.started`
2. `semantic.column.enrich.completed`
3. `semantic.column.enrich.fallback`
4. `semantic.column.enrich.failed`

最小字段：
1. `trace_id`
2. `app_id`
3. `table_name`
4. `field`
5. `action`（insert/upsert/deactivate）
6. `status`
7. `error_message`

## 9. 验收口径

1. 新增列后 5 秒内能查到该列语义记录。
2. 变更列名后语义名称同步更新。
3. 删除列后语义为失活而非丢失。
4. 任意失败不影响用户保存与发布。

