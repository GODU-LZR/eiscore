-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: repair question-mark garbling in ontology semantic metadata.
-- Safe to run multiple times.

BEGIN;

SET client_encoding = 'UTF8';

-- 1) Repair known table/view semantic labels that were previously written as question marks.
WITH fixes(table_schema, table_name, semantic_name, semantic_description) AS (
  VALUES
    ('app_center', 'workflow_permission_policies', '流程权限策略', '流程 V2 状态流转与审批权限策略'),
    ('app_center', 'workflow_transition_rules', '流程流转规则', '业务状态与流程状态流转规则配置'),

    ('app_data', 'ontology_table_relations', '本体表关系', '数据表、字段、权限与应用之间的本体关系'),
    ('app_data', 'twin_knowledge_files', '数字分身知识文件', '数字分身知识库上传文件'),
    ('app_data', 'twin_messages', '数字分身消息', '数字分身对话消息记录'),
    ('app_data', 'twin_sessions', '数字分身会话', '数字分身对话会话'),
    ('app_data', 'twin_tool_logs', '数字分身工具日志', '数字分身工具调用日志'),
    ('app_data', 'v_twin_overview', '数字分身总览', '数字分身知识与会话总览视图'),

    ('hr', 'v_attendance_daily', '每日考勤视图', '每日考勤统计查询视图'),
    ('hr', 'v_attendance_monthly', '月度考勤视图', '月度考勤统计查询视图'),

    ('public', 'debug_me', '调试信息', 'API schema public.debug_me 调试信息'),
    ('public', 'document_flow_audits', '单据流转审计', '业务单据跨模块流转审计记录'),
    ('public', 'document_links', '单据关联', '业务单据之间的上下游关联关系'),
    ('public', 'ontology_column_semantics', '字段语义', '本体字段语义、UI 类型与数据类型配置'),
    ('public', 'ontology_inference_rules', '本体推理规则', '知识图谱推理规则定义和启停配置'),
    ('public', 'ontology_inferred_facts', '本体推理事实', '本体推理引擎生成的事实关系'),
    ('public', 'ontology_reasoning_runs', '本体推理运行', '推理刷新批次、状态和事实数量'),
    ('public', 'ontology_table_semantics', '表语义', '数据表和视图的本体语义元数据'),
    ('public', 'purchase_arrivals', '采购到货', '采购到货与 IQC 检验衔接记录'),
    ('public', 'purchase_demands', '采购需求', '采购需求申请与计划记录'),
    ('public', 'purchase_orders', '采购订单', '采购订单主数据与执行记录'),
    ('public', 'purchase_suppliers', '供应商', '采购供应商主数据'),
    ('public', 'sales_customers', '销售客户', '客户主数据、信用额度、负责人和跟进状态'),
    ('public', 'sales_follow_ups', '销售跟进', '客户销售跟进记录'),
    ('public', 'sales_opportunities', '销售商机', '销售机会与阶段管理记录'),
    ('public', 'sales_orders', '销售订单', '销售订单主数据与交付记录'),
    ('public', 'sales_payments', '销售回款', '销售订单回款记录'),
    ('public', 'sop_learning_records', 'SOP 学习记录', '用户 SOP 学习状态与完成记录'),
    ('public', 'v_app_form_ontology', '应用表单本体', '应用、表单、字段与本体语义的投影视图'),
    ('public', 'v_bom_explosion', 'BOM 展开视图', 'API schema public.v_bom_explosion 关系的本体语义投影'),
    ('public', 'v_bom_items', 'BOM 明细视图', 'API schema public.v_bom_items 关系的本体语义投影'),
    ('public', 'v_boms', 'BOM 主数据视图', 'API schema public.v_boms 关系的本体语义投影'),
    ('public', 'v_field_labels', '字段标签视图', 'API schema public.v_field_labels 关系的本体语义投影'),
    ('public', 'v_ontology_coverage_audit', '本体覆盖审计', 'API schema public.v_ontology_coverage_audit 本体语义覆盖审计视图'),
    ('public', 'v_ontology_reasoning_edges', '推理关系边', '本体推理事实关系边查询视图'),
    ('public', 'v_ontology_reasoning_facts', '本体推理事实视图', '本体推理事实查询视图'),
    ('public', 'v_ontology_reasoning_health', '本体推理健康检查', '本体推理引擎健康状态视图'),
    ('public', 'v_ontology_reasoning_rule_stats', '推理规则统计', '本体推理规则命中和事实数量统计'),
    ('public', 'v_ontology_reasoning_summary', '推理摘要', '本体推理运行摘要和统计视图'),
    ('public', 'v_ontology_role_access_insights', '角色访问洞察', '角色到应用、权限、表和敏感字段的访问洞察'),
    ('public', 'v_ontology_sensitive_access_paths', '敏感访问路径', '敏感字段访问路径与风险提示视图'),
    ('public', 'v_ontology_table_dependency_paths', '表依赖路径', '数据表之间依赖路径查询视图'),
    ('public', 'v_ontology_table_impact_insights', '表影响分析', '数据表变更影响范围分析视图'),
    ('public', 'v_permission_ontology', '权限本体视图', '权限、角色和应用之间的本体关系视图'),
    ('public', 'v_purchase_order_progress', '采购订单进度', 'API schema public.v_purchase_order_progress 关系的本体语义投影'),
    ('public', 'v_role_data_scopes_matrix', '角色数据范围矩阵', 'API schema public.v_role_data_scopes_matrix 关系的本体语义投影'),
    ('public', 'v_role_ontology', '角色本体视图', '角色与权限、本体语义关系视图'),
    ('public', 'v_role_permission_ontology', '角色权限本体', '角色和权限关系的本体视图'),
    ('public', 'v_role_permissions', '角色权限视图', '角色权限关系查询视图'),
    ('public', 'v_role_permissions_matrix', '角色权限矩阵', 'API schema public.v_role_permissions_matrix 关系的本体语义投影'),
    ('public', 'v_roles_manage', '角色管理视图', 'API schema public.v_roles_manage 关系的本体语义投影'),
    ('public', 'v_sys_dict_items', '字典项视图', 'API schema public.v_sys_dict_items 关系的本体语义投影'),
    ('public', 'v_users_manage', '用户管理视图', 'API schema public.v_users_manage 关系的本体语义投影'),

    ('scm', 'v_bom_explosion', 'BOM 展开视图', 'API schema scm.v_bom_explosion 关系的本体语义投影'),
    ('scm', 'v_bom_items', 'BOM 明细视图', 'API schema scm.v_bom_items 关系的本体语义投影'),
    ('scm', 'v_boms', 'BOM 主数据视图', 'API schema scm.v_boms 关系的本体语义投影'),
    ('scm', 'v_inventory_current', '当前库存视图', 'API schema scm.v_inventory_current 关系的本体语义投影'),
    ('scm', 'v_inventory_drafts', '库存草稿视图', 'API schema scm.v_inventory_drafts 关系的本体语义投影'),
    ('scm', 'v_inventory_transactions', '库存流水视图', 'API schema scm.v_inventory_transactions 关系的本体语义投影'),
    ('scm', 'v_production_work_order_items', '生产工单明细视图', 'API schema scm.v_production_work_order_items 关系的本体语义投影'),
    ('scm', 'v_production_work_orders', '生产工单视图', 'API schema scm.v_production_work_orders 关系的本体语义投影'),

    ('workflow', 'task_approvals', '任务审批记录', '流程任务审批决策与意见记录')
)
UPDATE public.ontology_table_semantics AS s
SET semantic_name = f.semantic_name,
    semantic_description = f.semantic_description,
    is_active = true,
    updated_at = now()
FROM fixes AS f
WHERE s.table_schema = f.table_schema
  AND s.table_name = f.table_name
  AND (s.semantic_name LIKE '%?%' OR s.semantic_description LIKE '%?%');

-- 2) Dynamic app_data tables: prefer App Center labels.
UPDATE public.ontology_table_semantics AS s
SET semantic_name = format('动态业务表单(%s)', COALESCE(NULLIF(trim(a.name), ''), s.table_name)),
    semantic_description = format('应用中心数据应用“%s”对应业务表', COALESCE(NULLIF(trim(a.name), ''), s.table_name)),
    semantic_domain = COALESCE(NULLIF(s.semantic_domain, ''), 'app_data'),
    semantic_class = COALESCE(NULLIF(s.semantic_class, ''), 'dynamic_data_app'),
    is_business = true,
    is_active = true,
    updated_at = now()
FROM app_center.apps AS a
WHERE s.table_schema = 'app_data'
  AND s.table_name LIKE 'data_app_%'
  AND COALESCE(a.config ->> 'table', '') = ('app_data.' || s.table_name)
  AND (s.semantic_name LIKE '%?%' OR s.semantic_description LIKE '%?%');

-- 3) Deterministic fallback for any remaining table/view semantics.
UPDATE public.ontology_table_semantics AS s
SET semantic_name = s.table_schema || '.' || s.table_name,
    semantic_description = format('%s.%s 语义信息，请在本体工作台补充业务含义', s.table_schema, s.table_name),
    is_active = true,
    updated_at = now()
WHERE s.semantic_name LIKE '%?%' OR s.semantic_description LIKE '%?%';

-- 4) Repair column semantics. Preserve clean names; regenerate garbled names/descriptions.
WITH candidate AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.semantic_name,
    COALESCE(NULLIF(t.semantic_name, ''), c.table_schema || '.' || c.table_name) AS table_label,
    CASE
      WHEN c.column_name = 'id' THEN '主键ID'
      WHEN c.column_name = 'created_at' THEN '创建时间'
      WHEN c.column_name = 'updated_at' THEN '更新时间'
      WHEN c.column_name = 'deleted_at' THEN '删除时间'
      WHEN c.column_name = 'created_by' THEN '创建人'
      WHEN c.column_name = 'updated_by' THEN '更新人'
      WHEN c.column_name = 'created_by_user_id' THEN '创建用户ID'
      WHEN c.column_name = 'updated_by_user_id' THEN '更新用户ID'
      WHEN c.column_name IN ('name', 'display_name') THEN '名称'
      WHEN c.column_name IN ('code', 'key') THEN '编码'
      WHEN c.column_name IN ('title') THEN '标题'
      WHEN c.column_name IN ('description', 'desc') THEN '描述'
      WHEN c.column_name IN ('remarks', 'remark', 'notes', 'note') THEN '备注'
      WHEN c.column_name IN ('status', 'state') THEN '状态'
      WHEN c.column_name IN ('properties', 'metadata', 'payload', 'config') THEN '扩展属性'
      WHEN c.column_name IN ('tags') THEN '标签'
      WHEN c.column_name IN ('source') THEN '来源'
      WHEN c.column_name IN ('sort', 'sort_order') THEN '排序'
      WHEN c.column_name IN ('is_active', 'enabled', 'is_enabled') THEN '是否启用'
      WHEN c.column_name IN ('username') THEN '用户名'
      WHEN c.column_name IN ('full_name') THEN '姓名'
      WHEN c.column_name IN ('password_hash') THEN '密码哈希'
      WHEN c.column_name IN ('role', 'role_code') THEN '角色'
      WHEN c.column_name IN ('role_id') THEN '角色ID'
      WHEN c.column_name IN ('permission_id') THEN '权限ID'
      WHEN c.column_name IN ('user_id') THEN '用户ID'
      WHEN c.column_name IN ('employee_id') THEN '员工ID'
      WHEN c.column_name IN ('customer_id') THEN '客户ID'
      WHEN c.column_name IN ('supplier_id') THEN '供应商ID'
      WHEN c.column_name IN ('material_id', 'product_material_id') THEN '物料ID'
      WHEN c.column_name IN ('warehouse_id') THEN '仓库ID'
      WHEN c.column_name IN ('app_id') THEN '应用ID'
      WHEN c.column_name IN ('definition_id') THEN '流程定义ID'
      WHEN c.column_name IN ('instance_id') THEN '流程实例ID'
      WHEN c.column_name IN ('task_id') THEN '任务ID'
      WHEN c.column_name IN ('table_schema') THEN '表Schema'
      WHEN c.column_name IN ('table_name') THEN '表名'
      WHEN c.column_name IN ('column_name') THEN '字段名'
      WHEN c.column_name IN ('semantic_name') THEN '语义名称'
      WHEN c.column_name IN ('semantic_description') THEN '语义描述'
      WHEN c.column_name IN ('semantic_domain') THEN '语义领域'
      WHEN c.column_name IN ('semantic_class') THEN '语义分类'
      WHEN c.column_name IN ('data_type') THEN '数据类型'
      WHEN c.column_name IN ('ui_type') THEN 'UI类型'
      WHEN c.column_name IN ('is_sensitive') THEN '是否敏感'
      WHEN c.column_name IN ('file_name', 'filename', 'original_filename') THEN '文件名'
      WHEN c.column_name IN ('file_size', 'size_bytes') THEN '文件大小'
      WHEN c.column_name IN ('mime_type') THEN 'MIME类型'
      WHEN c.column_name IN ('content_base64') THEN 'Base64内容'
      WHEN c.column_name LIKE '%_no' THEN replace(c.column_name, '_', ' ') || ' 编号'
      WHEN c.column_name LIKE '%_date' THEN replace(c.column_name, '_', ' ') || ' 日期'
      WHEN c.column_name LIKE '%_time' THEN replace(c.column_name, '_', ' ') || ' 时间'
      WHEN c.column_name LIKE '%_amount' THEN replace(c.column_name, '_', ' ') || ' 金额'
      WHEN c.column_name LIKE '%_price' THEN replace(c.column_name, '_', ' ') || ' 单价'
      WHEN c.column_name LIKE '%_quantity' OR c.column_name LIKE '%_qty' THEN replace(c.column_name, '_', ' ') || ' 数量'
      WHEN c.column_name LIKE '%_rate' THEN replace(c.column_name, '_', ' ') || ' 比率'
      WHEN c.column_name LIKE '%_id' THEN replace(regexp_replace(c.column_name, '_id$', ''), '_', ' ') || ' ID'
      ELSE c.column_name
    END AS generated_name
  FROM public.ontology_column_semantics AS c
  LEFT JOIN public.ontology_table_semantics AS t
    ON t.table_schema = c.table_schema
   AND t.table_name = c.table_name
  WHERE c.semantic_name LIKE '%?%' OR c.semantic_description LIKE '%?%'
),
fixed AS (
  SELECT
    table_schema,
    table_name,
    column_name,
    CASE
      WHEN semantic_name IS NULL OR trim(semantic_name) = '' OR semantic_name LIKE '%?%'
        THEN generated_name
      ELSE semantic_name
    END AS final_name,
    table_label
  FROM candidate
)
UPDATE public.ontology_column_semantics AS c
SET semantic_name = f.final_name,
    semantic_description = format('%s 字段“%s”语义自动回填', f.table_label, f.final_name),
    is_active = true,
    updated_at = now()
FROM fixed AS f
WHERE c.table_schema = f.table_schema
  AND c.table_name = f.table_name
  AND c.column_name = f.column_name;

-- 5) Fail loudly if question-mark garbling remains in ontology semantic metadata.
DO $$
DECLARE
  v_table_count INTEGER;
  v_column_count INTEGER;
  v_relation_count INTEGER;
BEGIN
  SELECT count(*) INTO v_table_count
  FROM public.ontology_table_semantics
  WHERE semantic_name LIKE '%?%' OR semantic_description LIKE '%?%';

  SELECT count(*) INTO v_column_count
  FROM public.ontology_column_semantics
  WHERE semantic_name LIKE '%?%' OR semantic_description LIKE '%?%';

  SELECT count(*) INTO v_relation_count
  FROM app_data.ontology_table_relations
  WHERE relation_type = 'ontology'
    AND (
      COALESCE(subject_semantic_name, '') LIKE '%?%'
      OR COALESCE(object_semantic_name, '') LIKE '%?%'
    );

  IF v_table_count <> 0 OR v_column_count <> 0 OR v_relation_count <> 0 THEN
    RAISE EXCEPTION
      'Ontology semantic garbling remains: table=%, column=%, relation=%',
      v_table_count, v_column_count, v_relation_count;
  END IF;
END $$;

COMMIT;
