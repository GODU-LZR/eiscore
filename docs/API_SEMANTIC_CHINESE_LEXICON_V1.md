# EISCore 接口语义中文词表（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：闪念 Agent、应用中心 Agent、本体工作台语义检索

## 1. 目标

把业务人员的中文口语稳定归一化为 `intent + object + tool_id`，提升命中率，减少误调接口。

## 2. 意图词典（Intent Lexicon）

| intent | 中文标准词 | 常见口语别名 | 工具风险 |
|---|---|---|---|
| `read_list` | 列表查询 | 看看列表、查一下、帮我列出来、给我看全部 | low |
| `read_detail` | 详情查询 | 看详情、看这一条、打开这条记录 | low |
| `read_aggregate` | 统计汇总 | 统计、汇总、总数、分组统计、趋势 | low |
| `read_export` | 导出数据 | 导出、下载表格、导出Excel | low |
| `semantic_enrich` | 语义补全 | 补语义、补本体、自动标注含义 | medium |
| `configure_app` | 配置应用 | 配置、设置规则、改配置 | high |
| `create_record` | 新增记录 | 新建、添加、录入一条 | medium |
| `update_record` | 修改记录 | 编辑、修改、更新 | medium |
| `delete_record` | 删除记录 | 删除、移除、作废 | high |
| `start_workflow` | 发起流程 | 启动流程、提交审批、发起审批 | high |
| `transition_workflow` | 推进流程 | 审批通过、驳回、流转下一步 | high |

## 3. 对象词典（Object Lexicon）

| object | 中文标准词 | 同义词/口语 | 典型工具 |
|---|---|---|---|
| `app_registry` | 应用注册 | 应用中心、应用清单、应用卡片 | `cap.app.list` |
| `published_route` | 发布路由 | 访问路径、路由地址、发布入口 | `cap.route.resolve` |
| `data_table` | 表格应用数据 | 业务台账、数据表、列表数据 | `cap.data.grid.list` |
| `workflow_definition` | 流程定义 | 流程模板、流程图、审批模板 | `cap.workflow.definition.list` |
| `workflow_instance` | 流程实例 | 审批单、流程单、流程进度 | `cap.workflow.instance.list` |
| `workflow_event` | 流程日志 | 实例轨迹、流转记录、节点日志 | `cap.workflow.event.list` |
| `inventory_current` | 当前库存 | 库存现状、库存余额、库存快照 | `cap.inventory.current.list` |
| `ontology_relation` | 本体关系 | 语义关系、依赖关系、关系图 | `cap.ontology.relation.list` |
| `ontology_semantic` | 本体语义 | 语义定义、语义标签、语义描述 | `cap.ontology.semantic.list` |
| `hr_archive` | 人事花名册 | 员工档案、人员台账、员工信息 | `cap.hr.archive.list` |

## 4. 高频问法到工具映射（首批）

| 用户问法 | intent | object | tool_id |
|---|---|---|---|
| 帮我看一下应用中心所有应用 | `read_list` | `app_registry` | `cap.app.list` |
| 打开这个应用详情 | `read_detail` | `app_registry` | `cap.app.detail` |
| 这个路径属于哪个应用 | `read_detail` | `published_route` | `cap.route.resolve` |
| 看一下这张表的数据 | `read_list` | `data_table` | `cap.data.grid.list` |
| 看这条记录的详细信息 | `read_detail` | `data_table` | `cap.data.grid.detail` |
| 查这个流程的模板 | `read_list` | `workflow_definition` | `cap.workflow.definition.list` |
| 看流程实例进度 | `read_list` | `workflow_instance` | `cap.workflow.instance.list` |
| 看流程流转日志 | `read_list` | `workflow_event` | `cap.workflow.event.list` |
| 看当前库存情况 | `read_list` | `inventory_current` | `cap.inventory.current.list` |
| 看本体关系图 | `read_list` | `ontology_relation` | `cap.ontology.relation.list` |

## 5. 冲突消歧规则（必须）

1. 同时出现“发布/上线/生效”时，优先判为写操作，不走只读工具。
2. 出现“删除/移除/作废”时，必须判为高风险，不走只读工具。
3. 出现“流程模板/流程图”优先匹配 `workflow_definition`。
4. 出现“审批单/流程进度”优先匹配 `workflow_instance`。
5. 对象不明确时只允许追问，不允许盲调接口。

## 6. 归一化建议（NLP 前处理）

1. 全角半角统一。
2. 大小写统一（英文转小写）。
3. 常见错别字同义修正（如“花明册”->“花名册”）。
4. 业务缩写展开（如“HR”->“人事”）。
5. 停用词过滤（如“帮我”“麻烦你”“看一下”）。

## 7. 机器可读词表示例

```json
{
  "version": "zh-lexicon-v1",
  "intent_aliases": {
    "read_list": ["查列表", "列出来", "看看全部", "给我看清单"],
    "read_detail": ["看详情", "看这一条", "打开这条"],
    "read_aggregate": ["统计", "汇总", "总数", "分组"],
    "read_export": ["导出", "下载", "导出excel"]
  },
  "object_aliases": {
    "app_registry": ["应用中心", "应用清单", "应用卡片"],
    "workflow_definition": ["流程模板", "流程图", "审批模板"],
    "workflow_instance": ["审批单", "流程单", "流程进度"],
    "ontology_relation": ["本体关系", "语义关系", "依赖图"]
  }
}
```

## 8. 验收口径

1. 高频问法命中率 >= 85%（以首批 100 条样本评估）。
2. 写操作意图误命中只读工具比例 < 1%。
3. 未识别请求必须触发追问，不得静默失败。

