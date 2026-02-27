# EISCore 文档总览

说明：
- 仓库当前文档目录为 `docs/`（并非 `doc/`）。
- 当前仅保留基线文档与对照评估文档。

## 最新整合评估

- `PROJECT_COMPLETION_INTEGRATED_2026-02-27.md`  
  - 当前完成度整合评估（后端 Docker Compose + 前端 PM2 口径，含运行态快照、完成度矩阵、风险与下一步计划）。

## 推荐阅读顺序（2026-02-27）

1. `PROJECT_COMPLETION_INTEGRATED_2026-02-27.md`（当前总览）
2. `PROJECT_BACKGROUND_AND_POSITIONING.md`（立项目标基线）
3. `ONTOLOGY_SEMANTIC_AND_WORKFLOW_BASELINE_2026-02-23.md`（语义+流程落地基线）
4. `BUSINESS_TEST_REPORT_2026-02-09.md`（业务连通性回归快照）

## 历史快照说明

以下文档保留为阶段性快照，便于追溯，不作为当前唯一真值：

1. `DOC_CODE_COMPLETION_REVIEW_2026-02-08.md`
2. `BUSINESS_TEST_REPORT_2026-02-09.md`
3. `ONTOLOGY_SEMANTIC_PROGRESS_2026-02-23.md`
4. `ONTOLOGY_SEMANTIC_AND_WORKFLOW_BASELINE_2026-02-23.md`

## A. 当前基线文档（优先阅读）

1. `PROJECT_BACKGROUND_AND_POSITIONING.md`  
   - 项目前置背景、研究意义、技术路线、预期目标与关键问题（2026-02-08整理）。
2. `DOC_CODE_COMPLETION_REVIEW_2026-02-08.md`  
   - 规划文档与代码实现对照、完成度估算、差异清单（静态审查）。
3. `LEGACY_SPECIFICATIONS_SUMMARY.md`  
   - 子目录历史规范文档汇总（权限点、列权限、字段命名）。
4. `STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`  
   - 状态、权限、工作流三者的统一裁决链与整合矩阵（含 `status_transition` 权限模型）。
5. `EISCORE_MINIMAL_ONTOLOGY_V1.md`  
   - 项目最小语义本体词汇表（类、关系、属性、受控词表、规则与数据库映射）。
6. `LIGHTWEIGHT_ONTOLOGY_ROLLOUT.md`  
   - 轻量本体可执行落地说明（SQL补丁、兼容策略、验证步骤）。
7. `ONTOLOGY_WORKFLOW_STATUS_V2_BLUEPRINT.md`  
   - 本体/流程/状态权限一体化 V2 蓝图（strict 模式、策略表、迁移规则、分阶段上线）。
8. `SEMANTICS_MODE_GOVERNANCE_MATRIX.md`  
   - 语义来源模式治理矩阵（`ai_defined/creator_defined/none` + `compat/strict` 组合规则）。
9. `ONTOLOGY_COMPATIBILITY_PERMISSION_STANDARD.md`  
   - 本体兼容落地规范（明确“权限核心不变”的不可变条款与回归检查清单）。
10. `AGENT_AUTO_SEMANTICS_NO_TOUCH_SPEC_V1.md`
   - 新增应用“Agent 无感自动补语义”规范（含模块解析、触发链路、兼容边界与验收口径）。
11. `AGENT_SEMANTIC_CAPABILITY_CATALOG_V1.md`
   - Agent 语义能力清单（按现有接口分组，含意图-对象-能力映射、权限与风险分级）。
12. `WRITE_CONFIRMATION_AUDIT_EVENT_STANDARD.md`
   - 写操作二次确认与审计事件规范（触发矩阵、事件码、字段标准、兼容落点）。
13. `FLASH_AGENT_INTERFACE_CATALOG_V1.md`
   - 闪念应用可调用接口白名单目录（HTTP/WS、请求头、最小执行链路）。
14. `FLASH_AGENT_SEMANTIC_SCHEMA_V1.md`
   - 闪念接口语义字段标准（`tool_id/intent/object/risk/io_schema` 统一结构）。
15. `FLASH_AGENT_TOOL_CALL_CONTRACT_V1.md`
   - 闪念 Agent 工具调用协议（Tool Registry、请求响应格式、错误码、流式事件）。
16. `AGENT_READONLY_TOOLSET_V1.md`
   - 首批 10 个只读工具注册清单（低风险上线顺序、机器可读模板、验收口径）。
17. `DATA_APP_COLUMN_SEMANTIC_INCREMENTAL_RULES_V1.md`
   - 表格应用新增列语义增量规则（diff 算法、类型映射、失败回退与审计事件）。
18. `API_SEMANTIC_CHINESE_LEXICON_V1.md`
   - 接口语义中文词表（意图词、对象词、问法映射、冲突消歧规则）。
19. `agent/tool-registry.readonly.v1.json`
   - Agent 只读工具注册表（机器可读，首批 10 个工具）。
20. `agent/zh-query-testset.v1.json`
   - 中文问法评测集（100 条样本，含期望 `intent/object/tool_id`）。
21. `SQL_PATCH_UTF8_EXECUTION_STANDARD.md`
   - SQL 补丁 UTF-8 执行规范（PowerShell/WSL 命令模板、乱码校验与修复流程）。
22. `WORKFLOW_ROLE_SMOKE_TEST_CHECKLIST.md`
   - 流程角色冒烟测试清单（状态/权限/流程联动的执行步骤与验收口径）。
